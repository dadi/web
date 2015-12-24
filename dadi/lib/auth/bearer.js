var http = require('http');
var log = require(__dirname + '/../log');

var BearerAuthStrategy = function(options) {
  this.config = options;
  this.tokenRoute = options.tokenUrl || '/token';
  this.token = {};

  this.log = log.get().child({module: 'auth/bearer'});
};

BearerAuthStrategy.prototype.getToken = function(datasource, done) {

  var self = this;

  if (self.token.authToken && self.token.authToken.accessToken) {
    var now = Math.floor(Date.now() / 1000);
    // if the token creation date + expiry in seconds is greater
    // than the current time, we don't need to generate a new token
    if ((self.token.created_at + self.token.authToken.expiresIn) > now) {
      return done(null, self.token.authToken.accessToken);
    }
  }

  this.log.info('Generating new access token for datasource %s', datasource.name);

  var postData = {
    clientId : self.config.credentials.clientId,
    secret : self.config.credentials.secret
  };

  var options = {
    hostname: self.config.host,
    port: self.config.port,
    path: self.tokenRoute,
    method: 'POST',
    agent: new http.Agent({ keepAlive: true }),
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

      if (output === '') {
        var message = 'No token received, invalid credentials for datasource "' + datasource.name + '"';
        var err = new Error();
        err.name = 'Datasource authentication';
        err.message = message;
        err.remoteIp = options.hostname;
        err.remotePort = options.port;
        return done(err);
      }

      var tokenResponse = JSON.parse(output);
      self.token.authToken = tokenResponse;
      self.token.created_at = Math.floor(Date.now() / 1000);

      return done(null, self.token.authToken.accessToken);
    });
  });

  req.on('error', function (err) {
    var message = 'Couldn\'t request accessToken for datasource "' + datasource.name + '"';
    err.name = 'Datasource authentication';
    err.message = message;
    err.remoteIp = options.hostname;
    err.remotePort = options.port;
    return done(err);
  });

  // write data to request body
  req.write(JSON.stringify(postData));

  req.end();
};

module.exports = function (options) {
  return new BearerAuthStrategy(options);
};

module.exports.BearerAuthStrategy = BearerAuthStrategy;
