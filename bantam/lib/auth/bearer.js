var http = require('http');
var logger = require(__dirname + '/../log');

var BearerAuthStrategy = function(options) {
  this.config = options;
  this.tokenRoute = options.tokenUrl || '/token';
  this.token = {};

  //console.log(this);
}

BearerAuthStrategy.prototype.getToken = function(done) {

  var self = this;

  if (self.token.authToken && self.token.authToken.accessToken) {
    var now = Math.floor(Date.now() / 1000);
    // if the token creation date + expiry in seconds is greater
    // than the current time, we don't need to generate a new token
    if ((self.token.created_at + self.token.authToken.expiresIn) > now) {
      return done(self.token.authToken.accessToken);
    }
  }

  console.log("[BEARER] Generating new access token...");

  var postData = {
    clientId : self.config.credentials.clientId,
    secret : self.config.credentials.secret
  };

  var options = {
    hostname: self.config.host,
    port: self.config.port,
    path: self.tokenRoute,
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

    res.setTimeout(10);

    res.on('end', function() {
      
      // console.log('end');
      // console.log('output: ' + output);

      if (output === '') {
        console.log('No token received, invalid credentials.');
        logger.prod('No token received, invalid credentials.');
        
        res.statusCode = 401;
        return done();
      }

      var tokenResponse = JSON.parse(output);
      self.token.authToken = tokenResponse;
      self.token.created_at = Math.floor(Date.now() / 1000);

      //console.log('Done.');
      
      return done(self.token.authToken.accessToken);
    });
  });

  req.on('error', function(err) {
    console.log(err);
    logger.prod('Error requesting accessToken from ' + options.hostname);
    return;
  });

  // write data to request body
  req.write(JSON.stringify(postData));

  try {
    req.end();
  }
  catch (e) {
    console.log(e);
  }
      
};

module.exports = function (options) {
  return new BearerAuthStrategy(options);
};

module.exports.BearerAuthStrategy = BearerAuthStrategy;