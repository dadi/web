const middleware = module.exports
const path = require('path')
const proxyaddr = require('proxy-addr')

const config = require(path.resolve(
  path.join(__dirname, '/../../../config.js')
))
const log = require('@dadi/logger')
const debug = require('debug')('web:middleware')

const HTTP = 'http:'
const HTTPS = 'https:'

const compileTrust = function (val) {
  if (typeof val === 'function') return val

  if (val === true) {
    // Support plain true/false
    return function () {
      return true
    }
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return function (a, i) {
      return i < val
    }
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(/ *, */)
  }

  return proxyaddr.compile(val || [])
}

middleware.handleHostHeader = function () {
  return function hostHeaderCheck (req, res, next) {
    if (!req.headers.host || req.headers.host === '') {
      res.statusCode = 400
      return res.end()
    } else {
      next()
    }
  }
}

middleware.setUpRequest = function () {
  return function populateRequest (req, res, next) {
    Object.defineProperty(req, 'protocol', {
      get: function () {
        let protocol = config.get('server.protocol')

        // var protocol = req.connection.encrypted ? 'https' : 'http'
        const trust = compileTrust(config.get('security.trustProxy'))

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
        const trust = compileTrust(config.get('security.trustProxy'))
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
        const trust = compileTrust(config.get('security.trustProxy'))
        const addrs = proxyaddr.all(this, trust)
        return addrs.slice(1).reverse()
      },
      enumerable: true,
      configurable: false
    })

    next()
  }
}

middleware.transportSecurity = function () {
  function securityEnabled () {
    const transportSecurity = config.get('security.transportSecurity')
    const protocol = config.get('server.protocol')
    return protocol === 'https' || transportSecurity
  }

  function redirect (req, res, scheme) {
    const location = scheme + '//' + req.headers.host + req.url
    res.writeHead(301, {
      Location: location
    })
    res.end()
  }

  if (securityEnabled()) {
    debug('Transport security is enabled.')
  } else {
    debug('Transport security is not enabled.')
  }

  return function protocolRedirect (req, res, next) {
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
