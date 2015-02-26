var http = require('http');
var querystring = require('querystring');

var config = require(__dirname + '/../../../config');
var logger = require(__dirname + '/../log');
var token = require(__dirname + '/token');

// This attaches middleware to the passed in app instance
module.exports = function (server) {

    var tokenRoute = config.auth.tokenUrl || '/token';

    // Authorize
    server.app.use(function (req, res, next) {

        if (token.authToken.accessToken) {
          var now = Math.floor(Date.now() / 1000);
          // if the token creation date + expiry in seconds is greater
          // than the current time, we don't need to generate a new token
          if ((token.created_at + token.authToken.expiresIn) > now) {
            return next();
          }
        }

        console.log("Generating new access token...");

        var postData = {
          clientId : config.auth.clientId,
          secret : config.auth.secret
        };

        var options = {
          hostname: config.api.host,
          port: config.api.port,
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
            var tokenResponse = JSON.parse(output);
            token.authToken = tokenResponse;
            token.created_at = Math.floor(Date.now() / 1000);

            console.log('Done.');
            return next();
          });
        });

        req.on('error', function(err) {
          console.log(err);
          logger.prod('Error requesting accessToken from ' + options.hostname);
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