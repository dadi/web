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

// module.exports.getToken = function () {
//   return Passport({
//     issuer: {
//       uri: config.get('api.protocol') + '://' + config.get('api.host'),
//       port: config.get('api.port'),
//       endpoint: config.get('auth.tokenUrl')
//     },
//     credentials: {
//       clientId: config.get('auth.clientId'),
//       secret: config.get('auth.secret')
//     },
//     wallet: 'file',
//     walletOptions: {
//       path: config.get('paths.tokenWallets') + '/' + help.generateTokenWalletFilename(config.get('api.host'), config.get('api.port'), config.get('auth.clientId'))
//     }
//   });
// };

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
