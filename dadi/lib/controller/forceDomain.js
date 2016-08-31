var domainRedirect = require('./domainRedirect')

var forceDomain = function (options) {
  return function (req, res, next) {
    var protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    var newRoute = domainRedirect(protocol, req.headers.host, req.url, options)
    var statusCode

    if (!newRoute) {
      return next()
    }

    statusCode = (newRoute.type === 'temporary') ? 307 : 301

    res.writeHead(statusCode, {
      Location: newRoute.url
    })
    res.end()
  }
}

module.exports = forceDomain
