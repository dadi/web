const url = require('url')

const forceDomain = function (options) {
  return function forceDomain (req, res, next) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const newRoute = domainRedirect(
      protocol,
      req.headers.host,
      req.url,
      options
    )
    let statusCode

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
const domainRedirect = function (protocol, hostHeader, url, options) {
  let rewrittenRoute
  let route

  options = Object.assign({}, options, {
    protocol: 'http',
    type: 'permanent'
  })

  const hostHeaderParts = (hostHeader || '').split(':')
  const hostname = hostHeaderParts[0] || ''
  const port = hostHeaderParts[1] - 0 || 80

  if (options.hostname.split(':').length > 1) {
    const hostnameParts = options.hostname.split(':')
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
const domainRewrite = function (route, options) {
  options = Object.assign(
    {},
    {
      protocol: undefined,
      hostname: undefined
    },
    options
  )

  let parsedRoute = url.parse(route)
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
