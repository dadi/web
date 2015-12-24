var http = require('http');
var url = require('url');
var querystring = require('querystring');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');
var token = require(__dirname + '/token');

// This attaches middleware to the passed in app instance
module.exports = function (server) {

    var tokenRoute = config.get('auth.tokenUrl') || '/token';

    // Authorize
    server.app.use(function (req, res, next) {

        var self = this;

        this.log = log.get().child({module: 'auth'});

        // don't authenticate *.jpg GET requests
        var path = url.parse(req.url).pathname;
        if (path.split(".").pop() === 'jpg') return next();

        if (token.authToken.accessToken) {
          var now = Math.floor(Date.now() / 1000);
          // if the token creation date + expiry in seconds is greater
          // than the current time, we don't need to generate a new token
          if ((token.created_at + token.authToken.expiresIn) > now) {
            return next();
          }
        }

        this.log.info('Generating new access token for "' + req.url + '"');
        help.timer.start('auth');

        var postData = JSON.stringify({
          clientId : config.get('auth.clientId'),
          secret : config.get('auth.secret')
        });

        var options = {
          hostname: config.get('api.host'),
          port: config.get('api.port'),
          path: tokenRoute,
          method: 'POST',
          agent: new http.Agent({ keepAlive: true }),
          headers: {
            'Content-Type': 'application/json'
          }
        };

        var request = http.request(options, function(res) {
          var output = '';

          res.on('data', function(chunk) {
            output += chunk;
          });

          res.on('end', function() {
            if (!output) {
              var err = new Error();
              var message = 'No token received, invalid credentials.';
              err.name = 'Authentication';
              err.message = message;
              err.remoteIp = options.hostname;
              err.remotePort = options.port;
              err.path = options.path;
              return next(err);
            }

            var tokenResponse = JSON.parse(output);
            token.authToken = tokenResponse;
            token.created_at = Math.floor(Date.now() / 1000);

            help.timer.stop('auth');

            return next();
          });
        });

        request.on('error', function(err) {
          var message = 'Couldn\'t request accessToken';
          err.name = 'Authentication';
          err.message = message;
          err.remoteIp = options.hostname;
          err.remotePort = options.port;

          help.timer.stop('auth');
          next(err);
        });

        // write data to request body
        request.write(postData);

        request.end();
    });

};
