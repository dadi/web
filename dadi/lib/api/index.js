var _ = require('underscore')
var fs = require('fs')
var url = require('url')
var http = require('http')
var https = require('https')
var raven = require('raven')
var pathToRegexp = require('path-to-regexp')

var log = require(__dirname + '/../log')
var config = require(__dirname + '/../../../config')

/**
 * Represents the main server.
 * @constructor
 */
var Api = function () {
    this.paths = []
    this.all = []
    this.errors = []

    // Sentry error handler
    if (config.get('logging.sentry.dsn') !== "") {
      this.errors.push(raven.middleware.express.errorHandler(config.get('logging.sentry.dsn')))
    }

    // Fallthrough error handler
    this.errors.push(onError(this))

    // permanently bind context to listener
    this.listener = this.listener.bind(this)

    this.protocol = config.get('server.protocol') || 'http'

    if (this.protocol === 'https') {
        var readFileSyncSafe = (path) => {
            try { return fs.readFileSync(path) }
            catch (ex) {}
            return null
        }

        var passphrase = config.get('server.sslPassphrase')
        var caPath = config.get('server.sslIntermediateCertificatePath')
        var caPaths = config.get('server.sslIntermediateCertificatePaths')
        var serverOptions = {
            key: readFileSyncSafe(config.get('server.sslPrivateKeyPath')),
            cert: readFileSyncSafe(config.get('server.sslCertificatePath'))
        }

        if (passphrase && passphrase.length > 4) {
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
        
        this.server = https.createServer(serverOptions, this.listener)
    } else {
        // default to http
        this.server = http.createServer(this.listener)
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

    this.paths.sort((a,b) => {
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
            }
            else {
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
 *  convenience method that creates http server and attaches listener
 *  @param {Number} port
 *  @param {String} host
 *  @param {Number} backlog
 *  @param {Function} [done]
 *  @return http.Server
 *  @api public
 */
Api.prototype.listen = function (port, host, backlog, done) {
    return this.server.listen(port, host, backlog, done)
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
    var path = url.parse(req.url).pathname

    req.paths = []

    // get matching routes, and add req.params
    var matches = this._match(path, req)

    var originalReqParams = req.params

    var doStack = function (i) {
        return function (err) {

            if (err) return errStack(0)(err)

            // add the original params back, in case a middleware
            // has modified the current req.params
            _.extend(req.params, originalReqParams)

            try {
              stack[i](req, res, doStack(++i))
            }
            catch (e) {
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
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {String} path
 *  @param {http.IncomingMessage} req
 *  @return Array
 *  @api private
 */
Api.prototype._match = function (path, req) {
    var paths = this.paths
    var matches = []
    var handlers = []

    // always add params object to avoid need for checking later
    req.params = {}

    for (i = 0; i < paths.length; i++) {
        var match = paths[i].regex.exec(path)

        if (!match) { continue }

        req.paths.push(paths[i].path)

        var keys = paths[i].regex.keys
        handlers.push(paths[i].handler)

        match.forEach(function (k, i) {
            var keyOpts = keys[i] || {}
            if (match[i + 1] && keyOpts.name && !req.params[keyOpts.name]) req.params[keyOpts.name] = match[i + 1]
        })

        //break
    }

    return handlers
}

module.exports = function () {
    return new Api()
}

module.exports.Api = Api

function onError(api) {
  return function (err, req, res, next) {

    if (res.finished) return

    if (config.get('env') === 'development') {
      console.log()
      console.log(err.stack.toString())
    }

    log.error({module: 'api'}, err)

    var data = {
      statusCode: err.statusCode || 500,
      code: err.name,
      message: err.message,
      stack : err.stack.split('\n')
    }

    // look for a loaded path that matches the error code
    var path = _.findWhere(api.paths, { path: '/' + data.statusCode })
    // fallback to a generic /error path
    if (!path) path = _.findWhere(api.paths, { path: '/error' })

    if (path) {
      req.error = data
      res.statusCode = data.statusCode
      path.handler(req, res)
    }
    else {
      // no page found to display the error, output raw data
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data, null, 2))
    }
  }
}

// return a 404
function notFound(api, req, res) {
    return function () {

        res.statusCode = 404

        // look for a 404 page that has been loaded
        // along with the rest of the API, and call its
        // handler if it exists

        var path = _.findWhere(api.paths, { path: '/404' })
        if (path) {
            path.handler(req, res)
        }
        // otherwise, respond with default message
        else {
            res.end("HTTP 404 Not Found")
        }
    }
}

function routePriority(path, keys) {

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

    var order = (staticRouteLength * 5) + (requiredParamLength * 2) + (optionalParamLength)

    // make internal routes less important...
    if (path.indexOf('/config') > 0) order = -100
    if (path.indexOf('/api/') > 0) order = -100

    return order
}
