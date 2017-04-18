/**
 * @module Auth
 */
var path = require('path')

var config = require(path.join(__dirname, '/../../../config.js'))
var help = require(path.join(__dirname, '/../help'))
var log = require('@dadi/logger')

// This attaches middleware to the passed in app instance
module.exports = function (server) {
  server.app.use(function (req, res, next) {
    log.info({module: 'auth'}, 'Retrieving access token for "' + req.url + '"')
    help.timer.start('auth')

    return help.getToken().then(function (bearerToken) {
      help.timer.stop('auth')

      return next()
    }).catch(function (errorData) {
      var err = new Error()
      err.statusCode = 401
      err.name = errorData.title
      err.message = errorData.detail
      err.remoteIp = config.get('api.host')
      err.remotePort = config.get('api.port')
      err.path = config.get('auth.tokenUrl')

      help.timer.stop('auth')

      return next(err)
    })
  })
}
