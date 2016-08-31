var _ = require('underscore')

var domainRewrite = require('./domainRewrite')

var domainRedirect = function (protocol, hostHeader, url, options) {
  var hostHeaderParts,
    hostname,
    port,
    rewrittenRoute,
    route

  options = _.extend(options, {
    protocol: 'http',
    type: 'permanent'
  })

  hostHeaderParts = (hostHeader || '').split(':')
  hostname = hostHeaderParts[0] || ''
  port = (hostHeaderParts[1] - 0) || 80

  console.log(protocol)
  console.log(hostHeaderParts)
  console.log(port)
  console.log(options)

  if (
    (hostname === 'localhost') ||
    (hostname === options.hostname && port === options.port && protocol === options.protocol)
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

module.exports = domainRedirect
