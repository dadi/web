var http = require('http');
var url = require('url');
var querystring = require('querystring');
var perfy = require('perfy');

var config = require(__dirname + '/../../../config.js');
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
        perfy.start('auth', false);

        var postData = {
          clientId : config.get('auth.clientId'),
          secret : config.get('auth.secret')
        };

        var options = {
          hostname: config.get('api.host'),
          port: config.get('api.port'),
          path: tokenRoute,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        };

        var req = http.request(options, function(res) {
          var output = '';

          res.on('data', function(chunk) {
            output += chunk;
          });

          res.on('end', function() {

            if (!output) {
              self.log.error('No token received, invalid credentials.');

              res.statusCode = 401;
              return next();
            }

            var tokenResponse = JSON.parse(output);
            token.authToken = tokenResponse;
            token.created_at = Math.floor(Date.now() / 1000);

            if (perfy.exists('auth')) perfy.end('auth');

            self.log.info('Token received.');
            return next();
          });
        });

        req.on('error', function(err) {
          self.log.error(err);
          self.log.error('Error requesting accessToken from ' + options.hostname);
          next();
        });

        // write data to request body
        req.write(JSON.stringify(postData));

        try {
          req.end();
        }
        catch (e) {
        }

    });

};
