var _ = require('underscore')
var fs = require('fs')
var http = require('http')
var https = require('https')
var nodePath = require('path')
var raven = require('raven')
var pathToRegexp = require('path-to-regexp')
var url = require('url')

var log = require('@dadi/logger')
var config = require(nodePath.join(__dirname, '/../../../config'))

/**
 * Represents the main server.
 * @constructor
 */
var Api = function () {
  this.paths = []
  this.all = []
  this.errors = []

  // Sentry error handler
  if (config.get('logging.sentry.dsn') !== '') {
    this.errors.push(raven.middleware.express.errorHandler(config.get('logging.sentry.dsn')))
  }

  // Fallthrough error handler
  this.errors.push(onError(this))

  // permanently bind context to listener
  this.listener = this.listener.bind(this)

  var httpEnabled = config.get('server.http.enabled')
  var httpsEnabled = config.get('server.https.enabled')
  if (!httpEnabled && !httpsEnabled) httpEnabled = true

  // http only
  if (httpEnabled && !httpsEnabled) {
    this.httpInstance = http.createServer(this.listener)
  }

  // https enabled
  if (httpsEnabled) {

    // Redirect http to https
    if (httpEnabled) {
      this.redirectInstance = http.createServer(this.redirectListener)
    }

    var readFileSyncSafe = (path) => {
      try { return fs.readFileSync(path) } catch (ex) { console.log('error loading ssl file:', ex) }
      return null
    }

    var passphrase = config.get('server.https.sslPassphrase')
    var caPath = config.get('server.https.sslIntermediateCertificatePath')
    var caPaths = config.get('server.https.sslIntermediateCertificatePaths')
    var serverOptions = {
      key: readFileSyncSafe(config.get('server.https.sslPrivateKeyPath')),
      cert: readFileSyncSafe(config.get('server.https.sslCertificatePath'))
    }

    if (passphrase && passphrase.length >= 4) {
      serverOptions.passphrase = passphrase
    }

    if (caPaths && caPaths.length > 0) {
      serverOptions.ca = []
      caPaths.forEach((path) => {
        var data = readFileSyncSafe(path)
        data && serverOptions.ca.push(data)
      })
    } else if (caPath && caPath.length > 0) {
      serverOptions.ca = readFileSyncSafe(caPath)
    }

    // we need to catch any errors resulting from bad parameters
    // such as incorrect passphrase or no passphrase provided
    try {
      this.httpsInstance = https.createServer(serverOptions, this.listener)
    } catch (ex) {
      var exPrefix = 'error starting https server: '
      switch (ex.message) {
        case 'error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt':
          throw new Error(exPrefix + 'incorrect ssl passphrase')
        case 'error:0906A068:PEM routines:PEM_do_header:bad password read':
          throw new Error(exPrefix + 'required ssl passphrase not provided')
        default:
          throw new Error(exPrefix + ex.message)
      }
    }
  }
}

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function (path, handler) {
  if (typeof path === 'function') {
    if (path.length === 4) return this.errors.push(path)
    return this.all.push(path)
  }

  var regex = pathToRegexp(path)

  this.paths.push({
    path: path,
    order: routePriority(path, regex.keys),
    handler: handler,
    regex: regex
  })

  log.warn({module: 'api'}, 'Loaded ' + path)

  this.paths.sort((a, b) => {
    return b.order - a.order
  })
}

/**
 *  Removes a handler or removes the handler attached to a specific path
 *  @param {String} path
 *  @return undefined
 *  @api public
 */
Api.prototype.unuse = function (path) {
  var indx = 0

  if (typeof path === 'function') {
    if (path.length === 4) {
      indx = this.errors.indexOf(path)
      return !!~indx && this.errors.splice(indx, 1)
    }

    var functionStr = path.toString()
    _.each(this.all, function (func) {
      if (func.toString() === functionStr) {
        return this.all.splice(indx, 1)
      } else {
        indx++
      }
    }, this)

  // indx = this.all.indexOf(path)
  // return !!~indx && this.all.splice(indx, 1)
  }

  var existing = _.findWhere(this.paths, { path: path })
  this.paths = _.without(this.paths, existing)
}

/**
 *  convenience method that creates http/https server and attaches listener
 *  @param {Number} backlog
 *  @param {Function} [done]
 *  @return http.Server or https.Server
 *  @api public
 */
Api.prototype.listen = function (backlog, done) {
  var httpPort = config.get('server.http.port')
  var httpHost = config.get('server.http.host')
  var httpsPort = config.get('server.https.port')
  var httpsHost = config.get('server.https.host')

  // If http only, return the http instance
  if (this.httpInstance) {
    return this.httpInstance.listen(httpPort, httpHost, backlog, done)
  }

  // If http should redirect to https, listen but don't return
  if (this.redirectInstance) {
    this.redirectInstance.listen(httpPort, httpHost, backlog, done)
  }

  // If https enabled, return the https instance
  if (this.httpsInstance) {
    return this.httpsInstance.listen(httpsPort, httpsHost, backlog, done)
  }
}

/**
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.listener = function (req, res) {
  // clone the middleware stack
  var stack = this.all.slice(0)

  req.params = {}
  req.paths = []

  // get matching routes, and add req.params
  var matches = this._match(req)

  var originalReqParams = req.params

  var doStack = function (i) {
    return function (err) {
      if (err) return errStack(0)(err)

      // add the original params back, in case a middleware
      // has modified the current req.params
      _.extend(req.params, originalReqParams)

      try {
        stack[i](req, res, doStack(++i))
      } catch (e) {
        return errStack(0)(e)
      }
    }
  }

  var self = this

  var errStack = function (i) {
    return function (err) {
      self.errors[i](err, req, res, errStack(++i))
    }
  }

  // add path specific handlers
  stack = stack.concat(matches)

  // add 404 handler
  stack.push(notFound(this, req, res))

  // start going through the middleware/routes
  doStack(0)()
}

/**
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.redirectListener = function (req, res) {
  var httpsPort = config.get('server.https.port')
  var hostname = req.headers.host.split(':')[0]
  var location = 'https://' + hostname + ':' + httpsPort + req.url

  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {http.IncomingMessage} req - the current request
 *  @return {Array} handlers - the handlers that best matched the current URL
 *  @api private
 */
Api.prototype._match = function (req) {
  var path = url.parse(req.url).pathname
  var paths = this.paths
  var handlers = []

  for (var idx = 0; idx < paths.length; idx++) {
    // test the supplied url against each loaded route.
    // for example: does "/test/2" match "/test/:page"?
    var match = paths[idx].regex.exec(path)

    // move to the next route if no match
    if (!match) { continue }

    req.paths.push(paths[idx].path)

    // get all the dynamic keys from the route
    // i.e. anything that starts with ":" -> "/news/:title"
    // var keys = paths[idx].regex.keys

    // add this route's controller
    handlers.push(paths[idx].handler)
  }

  return handlers
}

function onError (api) {
  return function (err, req, res, next) {
    if (res.finished) return

    if (config.get('env') === 'development') {
      console.log()
      console.log(err.stack && err.stack.toString() || err)
    }

    log.error({module: 'api'}, err)

    var data = {
      statusCode: err.statusCode || 500,
      code: err.name,
      message: err.message
    }

    if (err.stack) {
      data.stack = err.stack.split('\n')
    }

    // look for a loaded path that matches the error code
    var path = _.findWhere(api.paths, { path: '/' + data.statusCode })
    // fallback to a generic /error path
    if (!path) path = _.findWhere(api.paths, { path: '/error' })

    if (path) {
      req.error = data
      res.statusCode = data.statusCode
      path.handler(req, res)
    } else {
      // no page found to display the error, output raw data
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data, null, 2))
    }
  }
}

// return a 404
function notFound (api, req, res) {
  return function () {
    res.statusCode = 404

    // look for a 404 page that has been loaded
    // along with the rest of the API, and call its
    // handler if it exists
    var path = _.findWhere(api.paths, { path: '/404' })

    if (path) {
      path.handler(req, res)
    } else {
      // otherwise, respond with default message
      res.end('HTTP 404 Not Found')
    }
  }
}

function routePriority (path, keys) {
  var tokens = pathToRegexp.parse(path)

  var staticRouteLength = 0
  if (typeof tokens[0] === 'string') {
    staticRouteLength = _.compact(tokens[0].split('/')).length
  }

  var requiredParamLength = _.filter(keys, function (key) {
    return !key.optional
  }).length

  var optionalParamLength = _.filter(keys, function (key) {
    return key.optional
  }).length

  // if there is a "page" parameter in the route, give it a slightly higher priority
  var paginationParam = _.find(keys, (key) => { return key.name && key.name === 'page' })

  var order = (staticRouteLength * 5) + (requiredParamLength * 2) + (optionalParamLength) + (typeof paginationParam === 'undefined' ? 0 : 1)

  // make internal routes less important...
  if (path.indexOf('/config') > 0) order = -100
  if (path.indexOf('/api/') > 0) order = -100

  return order
}

module.exports = function () {
  return new Api()
}

module.exports.Api = Api
