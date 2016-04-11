/**
 * @module Auth
 */
var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');
var passport = require('dadi-passport');

module.exports = function (server) {
  server.app.use(function (req, res, next) {
    passport({
      uri: 'http://' + config.get('api.host') + ':' + config.get('api.port'),
      credentials: {
        clientId: config.get('auth.clientId'),
        secret: config.get('auth.secret')
      },
      wallet: 'file',
      walletOptions: {
        path: __dirname + '/token.js'
      }
    }).then(function (bearerToken) {
      return next();
    })
  })
  // if (!output) {
  //   var err = new Error();
  //   var message = 'No token received, invalid credentials.';
  //   err.name = 'Authentication';
  //   err.message = message;
  //   err.remoteIp = options.hostname;
  //   err.remotePort = options.port;
  //   err.path = options.path;
  //   return next(err);
  // }
}
