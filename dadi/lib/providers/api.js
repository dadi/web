/*
 * TODO: move API related things to here
 */

var _ = require('underscore')
var url = require('url')
var http = require('http')
var https = require('https')
var zlib = require('zlib')

var config = require(__dirname + '/../../../config.js');
var log = require(__dirname + '/../log');
var help = require(__dirname + '/../help');
var BearerAuthStrategy = require(__dirname + '/../auth/bearer')
var DatasourceCache = require(__dirname + '/../cache/datasource');

var ApiProvider = function () {}

ApiProvider.prototype.initialise = function (datasource, schema) {
  console.log('--> initialise'.red)
  console.log('--> datasource'.red, datasource)
  console.log('--> schema'.red, schema)
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
  this.buildEndpoint()
}

ApiProvider.prototype.setAuthStrategy = function () {
  if (!this.schema.datasource.auth) return null
  this.authStrategy = new BearerAuthStrategy(this.schema.datasource.auth)
}

ApiProvider.prototype.processRequest = function (datasource, req) {
  // (datasource, req) unused
  console.log('--> processRequest'.red)
  this.buildEndpoint()
}

/**
 *  Constructs the datasource endpoint using properties defined in the schema
 *  @param {JSON} schema - ?
 *  @param done - the callback that handles the response
 *  @public
 */
ApiProvider.prototype.buildEndpoint = function () {
  console.log('--> buildEndpoint'.red)
  var schema = this.schema
  var uri = ''

  var apiConfig = config.get('api')

  var protocol = schema.datasource.source.protocol || 'http'
  var host = schema.datasource.source.host || apiConfig.host
  var port = schema.datasource.source.port || apiConfig.port

  uri = [protocol, '://', host, (port !== '' ? ':' : ''), port, '/', schema.datasource.source.endpoint].join('')

  this.endpoint = this.processDatasourceParameters(schema, uri)

  console.log('<-- buildEndpoint'.red, this.endpoint)
}

/**
 *  Adds querystring parameters to the datasource endpoint using properties defined in the schema
 *  @param {JSON} schema - the datasource schema
 *  @param {String} uri - the original datasource endpoint
 *  @public
 */
ApiProvider.prototype.processDatasourceParameters = function (schema, uri) {
  console.log('--> processDatasourceParameters'.red, schema, uri)
  var query = '?';

  var params = [
    {"count": (schema.datasource.count || 0)},
    {"skip": (schema.datasource.skip)},
    {"page": (schema.datasource.page || 1)},
    {"referer": schema.datasource.referer},
    {"filter": schema.datasource.filter || {}},
    {"fields": schema.datasource.fields || {}},
    {"sort": processSortParameter(schema.datasource.sort)}
  ];

  // pass cache flag to API endpoint
  if (schema.datasource.hasOwnProperty('cache')) {
    params.push({"cache": schema.datasource.cache});
  }

  params.forEach(function(param) {
    for (key in param) {
      if (param.hasOwnProperty(key) && (typeof param[key] !== 'undefined')) {
        query = query + key + "=" + (_.isObject(param[key]) ? JSON.stringify(param[key]) : param[key]) + '&';
      }
    }
    // if (params.indexOf(param) === (params.length-1)) {
    //   done(uri + query.slice(0,-1));
    // }
  });

  return uri + query.slice(0,-1);
}

ApiProvider.prototype.load = function (requestUrl, done) {
  var self = this

  this.requestUrl = requestUrl
  this.dataCache = new DatasourceCache(this.datasource, requestUrl)

  this.options = {
    protocol: this.datasource.source.protocol || config.get('api.protocol'),
    host: this.datasource.source.host || config.get('api.host'),
    port: this.datasource.source.port || config.get('api.port'),
    path: url.parse(this.endpoint).path,
    method: 'GET'
  }
  this.options.agent = this.keepAliveAgent(this.options.protocol)
  this.options.protocol = this.options.protocol + ':'

  this.dataCache.getFromCache(function (cachedData) {
    if (cachedData) return done(null, cachedData);

    self.getHeaders(function(err, headers) {
      if (err) {
        return done(err);
      }

      self.options = _.extend(self.options, headers);

      log.info({module: 'helper'}, "GET datasource '" + self.datasource.schema.datasource.key + "': " + self.options.path);

      var request;
      if (self.options.protocol === 'https') {
        request = https.request(self.options, function(res) {
          self.handleResponse(res, done)
        })
      }
      else {
        request = http.request(self.options, function(res) {
          self.handleResponse(res, done)
        })
      }

      request.on('error', function(err) {
        var message = err.toString() + '. Couldn\'t request data from ' + self.datasource.endpoint;
        err.name = 'GetData';
        err.message = message;
        err.remoteIp = self.options.host;
        err.remotePort = self.options.port;
        return done(err);
      });

      request.end();
    })
  })
}

ApiProvider.prototype.handleResponse = function(res, done) {
  var self = this;

  var output = '';
  var encoding = res.headers['content-encoding'] ? res.headers['content-encoding'] : '';

  if (encoding === 'gzip') {
    var gunzip = zlib.createGunzip();
    var buffer = [];

    gunzip.on('data', function(data) {
      buffer.push(data.toString());
    }).on('end', function() {
      output = buffer.join("");
      self.processOutput(res, output, function(err, data, res) {
        return done(null, data, res);
      });
    }).on('error', function(err) {
      done(err);
    });

    res.pipe(gunzip);
  }
  else {
    res.on('data', function(chunk) {
      output += chunk;
    });

    res.on('end', function() {
      self.processOutput(res, output, function(err, data, res) {
        return done(null, data, res);
      });
    });
  }
}

ApiProvider.prototype.processOutput = function(res, data, done) {
  var self = this;

  /* DEBUG */
  console.log('-- ApiProvider.prototype.processOutput:'.green)
  console.log(res.statusCode)
  console.log('!-- ApiProvider.prototype.processOutput:'.green)

  // Return a 202 Accepted response immediately,
  // along with the datasource response
  if (res.statusCode === 202) {
    return done(null, JSON.parse(data), res);
  }

  // if the error is anything other than
  // Success or Bad Request, error
  if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    var err = new Error();
    err.message = 'Datasource "' + this.datasource.name + '" failed. ' + res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.datasource.endpoint;
    if (data) err.message += '\n' + data;

    err.remoteIp = self.options.host;
    err.remotePort = self.options.port;

    log.error({module: 'helper'}, res.statusMessage + ' (' + res.statusCode + ')' + ": " + this.datasource.endpoint);
    //return done(err);
    throw(err);
  }

  // Cache 200 responses
  if (res.statusCode === 200) {
    this.dataCache.cacheResponse(data, function() {});
  }

  return done(null, data);
}

ApiProvider.prototype.keepAliveAgent = function(protocol) {
  if (protocol === 'https') {
    return new https.Agent({ keepAlive: true });
  }
  else {
    return new http.Agent({ keepAlive: true });
  }
}

ApiProvider.prototype.getHeaders = function(done) {
  var headers = {
    'accept-encoding': 'gzip'
  };

  // If the data-source has its own auth strategy, use it.
  // Otherwise, authenticate with the main server via bearer token
  if (this.datasource.authStrategy) {
    // This could eventually become a switch statement that handles different auth types
    if (this.datasource.authStrategy.getType() === 'bearer') {
      this.datasource.authStrategy.getToken(this.datasource, function (err, bearerToken) {
        if (err) {
          return done(err);
        }

        headers['Authorization'] = 'Bearer ' + bearerToken;

        return done(null, {headers: headers});
      });
    }
  } else {
    try {
      help.getToken(this.datasource).then(function (bearerToken) {
        headers['Authorization'] = 'Bearer ' + bearerToken;

        help.timer.stop('auth');
        return done(null, {headers: headers});
      }).catch(function (errorData) {
        var err = new Error();
        err.name = errorData.title;
        err.message = errorData.detail;
        err.remoteIp = config.get('api.host');
        err.remotePort = config.get('api.port');
        err.path = config.get('auth.tokenUrl');

        if (errorData.stack) {
          console.log(errorData.stack)
        }

        help.timer.stop('auth');
        return done(err);
      });
    }
    catch (err) {
      console.log(err.stack)
    }
  }
}

function processSortParameter(obj) {
  var sort = {};
  if (typeof obj !== 'object' || obj === null) return sort;

  if (_.isArray(obj)) {
    _.each(obj, function(value, key) {
      if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
        sort[value.field] = (value.order === 'asc') ? 1 : -1;
      }
    });
  }
  else if (obj.hasOwnProperty('field') && obj.hasOwnProperty('order')) {
    sort[obj.field] = (obj.order === 'asc') ? 1 : -1;
  }
  else {
    sort = obj;
  }

  return sort;
}

module.exports = ApiProvider
