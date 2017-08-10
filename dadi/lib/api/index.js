var _ = require('underscore')
var debug = require('debug')('web:api')
var fs = require('fs')
var http = require('http')
var https = require('https')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var raven = require('raven')
var url = require('url')

var log = require('@dadi/logger')
var config = require(path.join(__dirname, '/../../../config'))

var errorView = require(path.join(__dirname, '/../view/errors'))

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
    this.errors.push(
      raven.middleware.express.errorHandler(config.get('logging.sentry.dsn'))
    )
  }

  // Fallthrough error handler
  this.errors.push(onError(this))

  // permanently bind context to listener
  this.listener = this.listener.bind(this)

  this.protocol = config.get('server.protocol') || 'http'
  this.redirectPort = config.get('server.redirectPort')

  if (this.protocol === 'https') {
    // Redirect http to https
    if (this.redirectPort > 0) {
      this.redirectInstance = http.createServer(this.redirectListener)
    }

    var readFileSyncSafe = path => {
      try {
        return fs.readFileSync(path)
      } catch (ex) {
        console.log('error loading ssl file:', ex)
      }
      return null
    }

    var passphrase = config.get('server.sslPassphrase')
    var caPath = config.get('server.sslIntermediateCertificatePath')
    var caPaths = config.get('server.sslIntermediateCertificatePaths')
    var serverOptions = {
      key: readFileSyncSafe(config.get('server.sslPrivateKeyPath')),
      cert: readFileSyncSafe(config.get('server.sslCertificatePath'))
    }

    if (passphrase && passphrase.length >= 4) {
      serverOptions.passphrase = passphrase
    }

    if (caPaths && caPaths.length > 0) {
      serverOptions.ca = []
      caPaths.forEach(path => {
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
  } else {
    this.httpInstance = http.createServer(this.listener)
  }
}

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {String} host
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function (path, host, handler) {
  if (typeof path === 'function') {
    if (path.length === 4) return this.errors.push(path)
    return this.all.push(path)
  }

  if (typeof host === 'function') {
    handler = host
    host = ''
  } else if (typeof host === 'undefined') {
    host = ''
  }

  debug('use %s%s', host, path)

  var regex = pathToRegexp(path)
  var hostWithPath = `${host}${path}`

  this.paths.push({
    path: hostWithPath,
    order: routePriority(path, regex.keys),
    handler: handler,
    regex: regex
  })

  debug('loaded %s%s', host, path)

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
  debug('unuse %s', path)
  var indx = 0

  if (typeof path === 'function') {
    if (path.length === 4) {
      indx = this.errors.indexOf(path)
      return !!~indx && this.errors.splice(indx, 1)
    }

    var functionStr = path.toString()
    _.each(this.all, func => {
      if (func.toString() === functionStr) {
        return this.all.splice(indx, 1)
      } else {
        indx++
      }
    })

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
  var port = config.get('server.port')
  var host = config.get('server.host')
  var redirectPort = config.get('server.redirectPort')

  // If http only, return the http instance
  if (this.httpInstance) {
    return this.httpInstance.listen(port, host, backlog, done)
  }

  // If http should redirect to https, listen but don't return
  if (this.redirectInstance) {
    this.redirectInstance.listen(redirectPort, host, backlog, done)
  }

  // If https enabled, return the https instance
  if (this.httpsInstance) {
    return this.httpsInstance.listen(port, host, backlog, done)
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
  debug('request %s%s', req.headers.host, req.url)

  // clone the middleware stack
  this.stack = this.all.slice(0)

  req.params = {}
  req.paths = []

  var originalReqParams = req.params
  var pathsLoaded = false

  var doStack = stackIdx => {
    return err => {
      if (err) return errStack(0)(err)

      // add the original params back, in case a middleware
      // has modified the current req.params
      _.extend(req.params, originalReqParams)

      try {
        // if end of the stack, no middleware could handle the current
        // request, so get matching routes from the loaded page components and
        // add them to the stack just before the 404 handler, then continue the loop

        if (
          this.stack[stackIdx + 1] &&
          this.stack[stackIdx + 1].name === 'notFound' &&
          !pathsLoaded
        ) {
          // find path specific handlers
          var hrstart = process.hrtime()

          var matches = this.getMatchingRoutes(req)

          var hrend = process.hrtime(hrstart)
          debug(
            'getMatchingRoutes execution %ds %dms',
            hrend[0],
            hrend[1] / 1000000
          )

          if (!_.isEmpty(matches)) {
            // add the matches after the cache middleware and before the final 404 handler
            _.each(matches, match => {
              this.stack.splice(-1, 0, match)
            })
          }

          pathsLoaded = true
        }

        this.stack[stackIdx](req, res, doStack(++stackIdx))
      } catch (e) {
        return errStack(0)(e)
      }
    }
  }

  var errStack = stackIdx => {
    return err => {
      this.errors[stackIdx](err, req, res, errStack(++stackIdx))
    }
  }

  // push the 404 handler
  this.stack.push(notFound(this, req, res))

  // start going through the middleware
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
  var port = config.get('server.port')
  var hostname = req.headers.host.split(':')[0]
  var location = 'https://' + hostname + ':' + port + req.url

  res.setHeader('Location', location)
  res.statusCode = 302
  res.end()
}

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {http.IncomingMessage} req - the current request
 *  @return {Array} handlers - the handlers that best matched the current URL
 *  @api private
 */
Api.prototype.getMatchingRoutes = function (req) {
  var path = url.parse(req.url).pathname
  var handlers = []

  // get the host key that matches the request's host header
  var virtualHosts = config.get('virtualHosts')
  var host =
    _.findKey(virtualHosts, virtualHost => {
      return _.contains(virtualHost.hostnames, req.headers.host)
    }) || ''

  var paths = _.filter(this.paths, path => {
    return path.path.indexOf(host) > -1
  })

  for (var idx = 0; idx < paths.length; idx++) {
    // test the supplied url against each loaded route.
    // for example: does "/test/2" match "/test/:page"?
    var match = paths[idx].regex.exec(path)

    // move to the next route if no match
    if (!match) {
      continue
    }

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
      console.log((err.stack && err.stack.toString()) || err)
    }

    log.error({ module: 'api' }, err)

    var data = {
      statusCode: err.statusCode || 500,
      code: err.name,
      message: err.message
    }

    data.stack = err.stack ? err.stack : 'Nothing to see'

    // look for a page that has been loaded
    // that matches the error code and call its handler if it exists
    var path = findPath(req, api.paths, data.statusCode)

    // fallback to a generic /error path
    if (!path) {
      path = findPath(req, api.paths, '/error')
    }

    if (path && Array.isArray(path) && path[0]) {
      req.error = data
      res.statusCode = data.statusCode
      path[0].handler(req, res)
    } else {
      // no user error page found for this statusCode, use default error template
      res.statusCode = data.statusCode
      res.setHeader('Content-Type', 'text/html')
      res.end(
        errorView({
          headline: 'Something went wrong.',
          human:
            'We apologise, but something is not working as it should. It is not something you did, but we cannot complete this right now.',
          developer: data.message,
          stack: data.stack,
          statusCode: data.statusCode,
          error: data.code,
          server: req.headers.host
        })
      )
    }
  }
}

// return a 404
function notFound (api, req, res) {
  return function notFound () {
    res.statusCode = 404

    // look for a 404 page that has been loaded
    // and call its handler if it exists
    var path = findPath(req, api.paths, '404')

    if (path && Array.isArray(path) && path[0]) {
      path[0].handler(req, res)
    } else {
      // otherwise, respond with default message
      res.setHeader('Content-Type', 'text/html')
      res.end(
        errorView({
          headline: 'Page not found.',
          human:
            'This page has either been moved, or it never existed at all. Sorry about that, this was not your fault.',
          developer: 'HTTP Headers',
          stack: JSON.stringify(req.headers, null, 2),
          statusCode: '404',
          error: 'Page not found',
          server: req.headers.host
        })
      )
    }
  }
}

/**
 *
 * @param {Object} req -
 * @param {Array} paths -
 * @param {string} pathString -
 * @returns {Object} -
 */
function findPath (req, paths, pathString) {
  // get the host key that matches the request's host header
  var virtualHosts = config.get('virtualHosts')

  var host =
    _.findKey(virtualHosts, virtualHost => {
      return _.contains(virtualHost.hostnames, req.headers.host)
    }) || ''

  var matchingPaths = _.filter(paths, path => {
    return path.path.indexOf(host) > -1
  })

  // look for a page matching the pathString that has been loaded
  // along with the rest of the API
  return _.filter(matchingPaths, path => {
    return path.path.indexOf(pathString) > -1
  })
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
  var paginationParam = _.find(keys, key => {
    return key.name && key.name === 'page'
  })

  var order =
    staticRouteLength * 5 +
    requiredParamLength * 2 +
    optionalParamLength +
    (typeof paginationParam === 'undefined' ? 0 : 1)

  // make internal routes less important...
  if (path.indexOf('/config') > 0) order = -100
  if (path.indexOf('/api/') > 0) order = -100

  return order
}

module.exports = function () {
  return new Api()
}

module.exports.Api = Api
