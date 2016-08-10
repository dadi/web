/**
 * @module Help
 */
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');
var _ = require('underscore');
var perfy = require('perfy');
var crypto = require('crypto');
var zlib = require('zlib');

var auth = require(__dirname + '/auth');
var log = require('@dadi/logger');
var config = require(__dirname + '/../../config.js');
var cache = require(__dirname + '/cache');
var DatasourceCache = require(__dirname + '/cache/datasource');
var Passport = require('@dadi/passport');

var self = this;

module.exports.htmlEncode = function(input) {
    var encodedStr = input.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#'+i.charCodeAt(0)+';';
    });
    return encodedStr;
}

module.exports.timer = {

  isDebugEnabled: function isDebugEnabled() {
    return config.get('debug');
  },

  start: function start(key) {
    if (!this.isDebugEnabled()) return;
    console.log('Start timer: ' + key);
    perfy.start(key, false);
  },

  stop: function stop(key) {
    if (!this.isDebugEnabled()) return;
    console.log('Stop timer: ' + key);
    if (perfy.exists(key)) perfy.end(key);
  },

  getStats: function getStats() {
    if (!this.isDebugEnabled()) return;
    var stats = [];
    _.each(perfy.names(), function (key) {
      if (perfy.result(key)) stats.push( { key:key, value: perfy.result(key).summary } );
    });
    perfy.destroyAll();
    return stats;
  }

}

module.exports.isApiAvailable = function(done) {

  if (config.get('api.enabled') === false) {
    return done(null, true);
  }

  var options = {
    hostname: config.get('api.host'),
    port: config.get('api.port'),
    path: '/',
    method: 'GET'
  };

  var request;

  if (config.get('api.protocol') === 'https') {
    options.protocol = 'https:'
    request = https.request(options, function(res) {
      if (/200|401|404/.exec(res.statusCode)) {
        return done(null, true);
      }
    })
  }
  else {
    request = http.request(options, function(res) {
      if (/200|401|404/.exec(res.statusCode)) {
        return done(null, true);
      }
    })
  }

  request.on('error', function(e) {
    e.message = 'Error connecting to API: ' + e.message + '. Check the \'api\' settings in config file \'config/config.' + config.get('env') + '.json';
    e.remoteIp = options.hostname;
    e.remotePort = options.port;
    return done(e);
  });

  request.end();
}

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
    return function (err, results) {
        if (err) return next(err);

        var resBody = JSON.stringify(results, null, 4);

        res.setHeader('Server', config.get('server.name'));

        res.statusCode = successCode;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('content-length', Buffer.byteLength(resBody));
        res.end(resBody);
    }
}

module.exports.sendBackJSONP = function (callbackName, res, next) {
    return function (err, results) {

        // callback MUST be made up of letters only
        if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400);

        res.statusCode = 200;

        var resBody = JSON.stringify(results);
        resBody = callbackName + '(' + resBody + ');';
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('content-length', resBody.length);
        res.end(resBody);
    }
}

// helper that sends html response
module.exports.sendBackHTML = function (method, successCode, contentType, res, next) {

  return function (err, results) {

    if (err) {
      console.log(err);
      return next(err);
    }

    var resBody = results;

    res.statusCode = successCode;
    res.setHeader('Server', config.get('server.name'));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', Buffer.byteLength(resBody));
    //res.setHeader('Cache-Control', 'private, max-age=600');

    self.addHeaders(res);

    if (method.toLowerCase() === 'head') {
      res.setHeader('Connection', 'close');
      return res.end("");
    }
    else {
      return res.end(resBody);
    }
  }
}

/**
 * Checks for valid client credentials in the request body
 * @param {req} req - the HTTP request
 * @param {res} res - the HTTP response
 */
module.exports.validateRequestCredentials = function(req, res) {
  var clientId = req.body.clientId;
  var secret = req.body.secret;

  if (!clientId || !secret || (clientId !== config.get('auth.clientId') && secret !== config.get('auth.secret') )) {
    res.statusCode = 401;
    res.end();
    return false;
  }

  return true;
}

/**
 * Checks for valid HTTP method
 * @param {req} req - the HTTP request
 * @param {res} res - the HTTP response
 * @param {String} allowedMethod - the HTTP method valid for the current request
 */
module.exports.validateRequestMethod = function(req, res, allowedMethod) {
  var method = req.method && req.method.toLowerCase();
  if (method !== allowedMethod.toLowerCase()) {
    res.statusCode = 405;
    res.end();
    return false;
  }

  return true;
}

/**
 * Adds headers defined in the configuration file to the response
 * @param {res} res - the HTTP response
 */
module.exports.addHeaders = function(res) {
  var headers = config.get('headers');

  _.each(headers.cors, function(value, header) {
    res.setHeader(header, value);
    if (header === 'Access-Control-Allow-Origin' && value !== '*') {
      res.setHeader('Vary', 'Origin');
    }
  });
}

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function (queryStr) {
    var ret;
    try {
        // strip leading zeroes from querystring before attempting to parse
        ret = JSON.parse(queryStr.replace(/\b0(\d+)/, "\$1"));
    }
    catch (e) {
        ret = {};
    }

    // handle case where queryStr is "null" or some other malicious string
    if (typeof ret !== 'object' || ret === null) ret = {};
    return ret;
};

module.exports.clearCache = function (req, callback) {
  var pathname = req.body.path;
  var modelDir = crypto.createHash('sha1').update(pathname).digest('hex');
  var cachePath = path.join(config.get('caching.directory.path'), modelDir + '.' + config.get('caching.directory.extension'));
  var datasourceCachePaths = [];
  var files = fs.readdirSync(config.get('caching.directory.path'));

  if (pathname === '*') {
    modelDir = '';
    cachePath = path.join(config.get('caching.directory.path'), modelDir);

    files.filter(function(file) {
      return file.substr(-5) === '.json';
    }).forEach(function(file) {
      datasourceCachePaths.push(path.join(config.get('caching.directory.path'), file));
    });
  }
  else {
    var endpointRequest = {
      url: req.headers['host'] + pathname
    }

    var endpoint = cache().getEndpointMatchingRequest(endpointRequest);

    _.each(endpoint.page.datasources, function(datasource) {
      var cachePrefix = crypto.createHash('sha1').update(datasource).digest('hex');
      datasourceCachePaths = _.extend(datasourceCachePaths, _.filter(files, function(file) { return file.indexOf(cachePrefix) > -1; }));
      datasourceCachePaths = _.map(datasourceCachePaths, function(file) { return path.join(config.get('caching.directory.path'), file); });
    })
  }

  var walkSync = function(dir, filelist) {
    var fs = fs || require('fs'),
    files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function(file) {
      if (fs.statSync(dir + file).isDirectory()) {
        filelist = walkSync(dir + file + '/', filelist);
      }
      else {
        filelist.push(dir + file);
      }
    });
    return filelist;
  };
  // delete using Redis client
  if (cache.client()) {
    setTimeout(function() {
      cache.delete(modelDir, function(err) {
        return callback(null);
      });
    }, 200);
  }
  else {
    var i = 0;
    var exists = fs.existsSync(cachePath);

    if (!exists) {
      return callback(null);
    }
    else {
      if(fs.statSync(cachePath).isDirectory()) {

        var files = fs.readdirSync(cachePath);
        if(pathname == '*') {
          files = walkSync(cachePath + '/');
        }

        files.forEach(function (filename) {
          var file = path.join(cachePath, filename);
          if(pathname == '*') file = filename;

          fs.unlinkSync(file);

          i++;

          // finished, all files processed
          if (i == files.length) {
            return callback(null);
          }
        });
      } else {
        fs.unlinkSync(cachePath);

        datasourceCachePaths.forEach(function(filename) {
          fs.unlinkSync(filename);
          i++;

          // finished, all files processed
          if (i == datasourceCachePaths.length) {
            return callback(null);
          }
        });
      }
    }
  }
};

/**
 * Creates a URL/filename friendly version (slug) of any object that implements `toString()`
 * @param {Object} input - object to be slugified
 */
module.exports.slugify = function (input) {
  return input.toString()
            .toLowerCase()
            .replace(/[\?\#][\s\S]*$/g, '')
            .replace(/\/+/g, '-')
            .replace(/\s+/g, '')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
};

/**
 * Generates a filename for a token wallet file
 * @param {String} host - Issuer host
 * @param {Number} port - Issuer port
 * @param {String} clientId - Client ID
 */
module.exports.generateTokenWalletFilename = function (host, port, clientId) {
  return 'token.' + self.slugify(host + port) + '.' + self.slugify(clientId) + '.json';
};

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
      path: config.get('paths.tokenWallets') + '/' + this.generateTokenWalletFilename(config.get('api.host'), config.get('api.port'), config.get('auth.clientId'))
    }
  });
}

// creates a new function in the underscore.js namespace
// allowing us to pluck multiple properties - used to return only the
// fields we require from an array of objects
_.mixin({selectFields: function() {
        var args = _.rest(arguments, 1)[0];
        return _.map(arguments[0], function(item) {
            var obj = {};
            _.each(args.split(','), function(arg) {
                obj[arg] = item[arg];
            });
            return obj;
        });
    }
});
