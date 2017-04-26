var _ = require('underscore')
var url = require('url')

var forceDomain = function (options) {
  return function (req, res, next) {
    var protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    var newRoute = domainRedirect(protocol, req.headers.host, req.url, options)
    var statusCode

    if (!newRoute) {
      return next()
    }

    statusCode = newRoute.type === 'temporary' ? 307 : 301

    res.writeHead(statusCode, {
      Location: newRoute.url
    })

    res.end()
  }
}

/**
 *
 * @param {string} protocol - the protocol extracted from the current request, default 'http'
 * @param {string} hostHeader - the host header extracted from the current request, e.g. 'localhost:3000'
 * @param {string} url - the URL of the current request
 * @param {Object} options - the options passed in from the configuration block rewrites.forceDomain
 */
var domainRedirect = function (protocol, hostHeader, url, options) {
  var rewrittenRoute
  var route

  options = _.extend(options, {
    protocol: 'http',
    type: 'permanent'
  })

  var hostHeaderParts = (hostHeader || '').split(':')
  var hostname = hostHeaderParts[0] || ''
  var port = hostHeaderParts[1] - 0 || 80

  if (options.hostname.split(':').length > 1) {
    var hostnameParts = options.hostname.split(':')
    options.hostname = hostnameParts[0]
    options.port = hostnameParts[1]
  }

  if (
    hostname === 'localhost' ||
    (hostname === options.hostname &&
      port === options.port &&
      protocol === options.protocol)
  ) {
    return null
  }

  route = options.protocol + '://' + hostname + (port ? ':' + port : '') + url
  rewrittenRoute = domainRewrite(route, options)

  /* eslint-disable consistent-return */
  return {
    type: options.type,
    url: rewrittenRoute
  }
  /* eslint-enable consistent-return */
}

/**
 *
 */
var domainRewrite = function (route, options) {
  options = _.extend(
    {
      protocol: undefined,
      hostname: undefined
    },
    options
  )

  var parsedRoute = url.parse(route)
  parsedRoute.host = undefined

  if (options.protocol) {
    parsedRoute.protocol = options.protocol
  }
  if (options.hostname) {
    parsedRoute.hostname = options.hostname
  }
  if (options.port) {
    parsedRoute.port = options.port
  }

  return url.format(parsedRoute)
}

module.exports = forceDomain
