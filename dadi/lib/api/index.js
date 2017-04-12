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

var errorTemplate = '<!DOCTYPE html><html lang="en"> <head> <meta charset="utf-8"> <title>%%statusCode%% Error</title> <style type="text/css"> *{padding: 0; margin: 0;}html{height: 100%;}body{background: #f4f4f4; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; text-align: center; font-size: 17px; line-height: 23px; height: 100%;}.box{max-width: 500px; padding: 20px; margin: 0 auto; text-align: left;position: absolute;top: 50%; left: 0; right: 0;-webkit-transform: translateY(-50%);-ms-transform: translateY(-50%);transform: translateY(-50%);}.error{background: #e0e0e0; display: none; font-size: 14px; margin: 1.2em 0; overflow: hidden; border-radius: 3px; line-height: normal;}h1{font-size: 24px; margin: 1em 0 0.6em;}h2{background: #000; color: #fff; padding: 15px; font-size: 14px;}p{margin: 0 0 1.2em 0;}.error .stack{padding: 15px; overflow: scroll; -webkit-overflow-scroll: touch;}.error,.message{font-family: "Lucida Sans Typewriter", "Lucida Console", monaco, "Bitstream Vera Sans Mono", monospace;}.message{color: #999; margin-top: 1.2em; font-size: 14px;}.message span{color:#555}.message a{color: inherit;}#toggle:checked + .error{display: block;}label{cursor: pointer;border-radius: 4px;background: #295def;color: #fff;padding: 4px 7px;user-select: none;}</style> </head> <body> <div class="box"> <svg width="90" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96.2 83.9"><style>.st0{fill:#f79800}</style><path class="st0" d="M94.2 83.9H2c-.7 0-1.4-.4-1.7-1-.4-.6-.4-1.4 0-2L46.4 1c.4-.6 1-1 1.7-1s1.4.4 1.7 1l46.1 79.9c.4.6.4 1.4 0 2-.3.6-1 1-1.7 1zm-88.7-4h85.3L48.1 6 5.5 79.9z"/><path class="st0" d="M48.1 59c-1.1 0-2-.9-2-2V30.8c0-1.1.9-2 2-2s2 .9 2 2V57c0 1.1-.9 2-2 2zM48.1 70.4c-1.1 0-2-.9-2-2v-2.8c0-1.1.9-2 2-2s2 .9 2 2v2.8c0 1.1-.9 2-2 2z"/></svg> <h1>%%headline%%</h1> <p>%%human%%</p><label for="toggle" class="show-error">Show me the technical details</label> <input type="checkbox" name="toggle" id="toggle"/> <div class="error"> <h2>%%developer%%</h2><pre class="stack">%%stack%%</div></pre><p class="message"><span><a target="_blank" href="https://httpstatuses.com/%%statusCode%%">%%statusCode%%</a> %%error%%</span><br>%%server%%</p></div></body></html>'

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

  this.protocol = config.get('server.protocol') || 'http'
  this.redirectPort = config.get('server.redirectPort')

  if (this.protocol === 'http') {
    this.httpInstance = http.createServer(this.listener)
  } else if (this.protocol === 'https') {
    // Redirect http to https
    if (this.redirectPort > 0) {
      this.redirectInstance = http.createServer(this.redirectListener)
    }

    var readFileSyncSafe = (path) => {
      try { return fs.readFileSync(path) } catch (ex) { console.log('error loading ssl file:', ex) }
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
    _.each(this.all, (func) => {
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
        self.stack[i](req, res, doStack(++i))
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
  this.stack = this.stack.concat(matches)

  // add 404 handler
  this.stack.push(notFound(this, req, res))

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
  var port = config.get('server.port')
  var hostname = req.headers.host.split(':')[0]
  var location = 'https://' + hostname + ':' + port + req.url

  res.setHeader('Location', location)
  res.statusCode = 301
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
  var handlers = []

  // get the host key that matches the request's host header
  var virtualHosts = config.get('virtualHosts')
  var host = _.findKey(virtualHosts, (virtualHost) => {
    return _.contains(virtualHost.hostnames, req.headers.host)
  }) || ''

  var paths = _.filter(this.paths, (path) => {
    return path.path.indexOf(host) > -1
  })

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
      // no page found to display the error, output raw data
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/html')
      res.end(
        errorTemplate
          .replace(/%%headline%%/gmi, 'Something went wrong.')
          .replace(/%%human%%/gmi, 'We apologise, but something is not working as it should. It is not something you did, but we can not complete this right now.')
          .replace(/%%developer%%/gmi, data.message)
          .replace(/%%stack%%/gmi, data.stack)
          .replace(/%%statusCode%%/gmi, data.statusCode)
          .replace(/%%error%%/gmi, data.code)
          .replace(/%%server%%/gmi, req.headers.host)
      )
    }
  }
}

// return a 404
function notFound (api, req, res) {
  return function () {
    res.statusCode = 404

    // look for a 404 page that has been loaded
    // and call its handler if it exists
    var path = findPath(req, api.paths, '404')

    if (path && Array.isArray(path) && path[0]) {
      path[0].handler(req, res)
    } else {
      // otherwise, respond with default message
      res.end(
        errorTemplate
          .replace(/%%headline%%/gmi, 'Page not found.')
          .replace(/%%human%%/gmi, 'This page has either been moved, or it never existed at all. Sorry about that, this was not your fault.')
          .replace(/%%developer%%/gmi, 'HTTP Headers')
          .replace(/%%stack%%/gmi, JSON.stringify(req.headers, null, 2))
          .replace(/%%statusCode%%/gmi, '404')
          .replace(/%%error%%/gmi, 'Page not found')
          .replace(/%%server%%/gmi, req.headers.host)
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

  var host = _.findKey(virtualHosts, (virtualHost) => {
    return _.contains(virtualHost.hostnames, req.headers.host)
  }) || ''

  var matchingPaths = _.filter(paths, (path) => {
    return path.path.indexOf(host) > -1
  })

  // look for a page matching the pathString that has been loaded
  // along with the rest of the API
  return _.filter(matchingPaths, (path) => {
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
