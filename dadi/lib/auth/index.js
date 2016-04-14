/**
 * @module Auth
 */
var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');
var mkdirp = require('mkdirp');
var path = require('path');

var Passport = require('@dadi/passport');

var self = this;

// This attaches middleware to the passed in app instance
module.exports = function (server) {
  server.app.use(function (req, res, next) {
    log.info({module: 'auth'}, 'Retrieving access token for "' + req.url + '"');
    help.timer.start('auth');

    return help.getToken().then(function (bearerToken) {
      help.timer.stop('auth');

      return next();
    }).catch(function (errorData) {
      var err = new Error();
      err.name = errorData.title;
      err.message = errorData.detail;
      err.remoteIp = config.get('api.host');
      err.remotePort = config.get('api.port');
      err.path = config.get('auth.tokenUrl');

      help.timer.stop('auth');

      return next(err);
    });
  });
};
