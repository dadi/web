var middleware = module.exports
var path = require('path')
var proxyaddr = require('proxy-addr')

var config = require(path.resolve(path.join(__dirname, '/../../../config.js')))
var log = require('@dadi/logger')

var HTTP = 'http:'
var HTTPS = 'https:'

var compileTrust = function (val) {
  if (typeof val === 'function') return val

  if (val === true) {
    // Support plain true/false
    return function () { return true }
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return function (a, i) { return i < val }
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(/ *, */)
  }

  return proxyaddr.compile(val || [])
}

middleware.handleHostHeader = function () {
  return function (req, res, next) {
    if (!req.headers.host || req.headers.host === '') {
      res.statusCode = 400
      return res.end()
    } else {
      next()
    }
  }
}

middleware.setUpRequest = function () {
  return function (req, res, next) {
    Object.defineProperty(req, 'protocol', {
      get: function () {
        var protocol = config.get('server.https.enabled') && 'https' || 'http'

        // var protocol = req.connection.encrypted ? 'https' : 'http'
        var trust = compileTrust(config.get('security.trustProxy'))

        if (!trust(req.connection.remoteAddress, 0)) {
          return protocol
        }

        // Note: X-Forwarded-Proto is normally only ever a
        // single value, but this is to be safe.
        protocol = req.headers['x-forwarded-proto'] || protocol
        return protocol.split(/\s*,\s*/)[0]
      },
      enumerable: true,
      configurable: false
    })

    Object.defineProperty(req, 'secure', {
      get: function () {
        return req.protocol === 'https'
      },
      enumerable: true,
      configurable: false
    })

    /**
     * Return the remote address from the trusted proxy.
     *
     * The is the remote address on the socket unless
     * "trustProxy" is set (i.e. req.connection.remoteAddress)
     *
     * @return {String}
     * @public
     */
    Object.defineProperty(req, 'ip', {
      get: function () {
        var trust = compileTrust(config.get('security.trustProxy'))
        return proxyaddr(this, trust)
      },
      enumerable: true,
      configurable: false
    })

    /**
     * When "trustProxy" is set, trusted proxy addresses + client.
     *
     * For example if the value were "client, proxy1, proxy2"
     * you would receive the array `["client", "proxy1", "proxy2"]`
     * where "proxy2" is the furthest down-stream and "proxy1" and
     * "proxy2" were trusted.
     *
     * @return {Array}
     * @public
     */
    Object.defineProperty(req, 'ips', {
      get: function () {
        var trust = compileTrust(config.get('security.trustProxy'))
        var addrs = proxyaddr.all(this, trust)
        return addrs.slice(1).reverse()
      },
      enumerable: true,
      configurable: false
    })

    next()
  }
}

middleware.transportSecurity = function () {
  var protocol = config.get('server.https.enabled') && 'https' || 'http'
  var scheme = protocol === 'https' ? HTTPS : HTTP

  function securityEnabled () {
    return scheme === HTTPS
  }

  function redirect (req, res, scheme) {
    var location = scheme + '//' + req.headers.host + req.url
    res.writeHead(301, {
      Location: location
    })
    res.end()
  }

  if (securityEnabled()) {
    log.info('Transport security is enabled.')
  } else {
    log.info('Transport security is not enabled.')
  }

  return function (req, res, next) {
    if (securityEnabled() && !req.secure) {
      log.info('Redirecting insecure request for', req.url)
      redirect(req, res, HTTPS)
    } else if (!securityEnabled() && req.secure) {
      log.info('Redirecting secure request for', req.url)
      redirect(req, res, HTTP)
    } else {
      next()
    }
  }
}
