/**
 * @module Auth
 */
var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');

var Passport = require(__dirname + '/../../../../passport/node/src'); // !!! TODO: Replace with NPM

var self = this;

module.exports.getToken = function () {
  return Passport({
    issuer: {
      uri: config.get('api.protocol') + '://' + config.get('api.host'),
      port: config.get('api.port'),
      endpoint: config.get('auth.tokenUrl')  
    },
    credentials: {
      clientId: config.get('auth.clientId'),
      secret: config.get('auth.secret')
    },
    wallet: 'file',
    walletOptions: {
      path: __dirname + '/' + help.generateTokenWalletFilename(config.get('api.host'), config.get('api.port'), config.get('auth.clientId'))
    }
  });
};

// This attaches middleware to the passed in app instance
module.exports = function (server) {
  server.app.use(function (req, res, next) {
    log.info({module: 'auth'}, 'Retrieving access token for "' + req.url + '"');
    help.timer.start('auth');

    self.getToken().then(function (bearerToken) {
      help.timer.stop('auth');

      return next();
    }).catch(function (errorData) {
      var err = new Error();
      err.name = errorData.title;
      err.message = errorData.detail;
      err.remoteIp = options.issuer.uri;
      err.remotePort = options.issuer.port;
      err.path = options.issuer.endpoint;

      help.timer.stop('auth');

      return next(err);
    });    
  });
};
