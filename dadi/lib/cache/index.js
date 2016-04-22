/**
 * @module Cache
 */
var crypto = require('crypto');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var redis = require('redis');
var redisRStream = require('redis-rstream');
var redisWStream = require('redis-wstream');
var Readable = require('stream').Readable;
var url = require('url');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var log = require(__dirname + '/../log');
var help = require(__dirname + '/../help');

/**
 * Creates a new Cache instance for the server
 * @constructor
 * @param {Server} server - the main server instance
 */
var Cache = function(server) {
  log.info({module: 'cache'}, 'Cache logging started.');

  this.server = server;
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');
  this.dir = config.get('caching.directory.path');
  this.extension = config.get('caching.directory.extension');
  this.redisClient = null;
  this.encoding = 'utf8';
  this.options = {};

  var self = this;

  // create cache directory or initialise Redis
  if (config.get('caching.directory.enabled')) {
    mkdirp(self.dir, {}, function (err, made) {
      if (err) log.error({module: 'cache'}, err);
      if (made) log.info({module: 'cache'}, 'Created cache directory ' + made);
    });
  }
  else if (config.get('caching.redis.enabled')) {
    self.redisClient = self.initialiseRedisClient();

    self.redisClient.on("error", function (err) {
      log.error({module: 'cache'}, err);
    });
  }
};

var instance;
module.exports = function(server) {
  if (!instance) {
    instance = new Cache(server);
  }
  return instance;
};

/**
 * Determines whether caching is enabled by testing the main configuration setting and
 * the cache setting for the page that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {Boolean}
 */
Cache.prototype.cachingEnabled = function(req) {
  var query = url.parse(req.url, true).query;
  if (query.hasOwnProperty('json') && query.json !== 'false') {
    return false;
  }

  if (config.get('debug')) {
    return false;
  }

  var endpoint = this.getEndpointMatchingRequest(req);

  // not found in the loaded routes, let's not bother caching
  if (!endpoint) return false;

  if (endpoint.page && endpoint.page.settings) {
      this.options = endpoint.page.settings;
  }
  else {
      this.options.cache = false;
  }

  return (this.enabled && (this.options.cache || false));
};

/**
 * Retrieves the page that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {object}
 */
Cache.prototype.getEndpointMatchingRequest = function(req) {
  var endpoints = this.server.components;
  var requestUrl = url.parse(req.url, true).pathname;

  // check if there is a match in the loaded routes for the current request URL
  var endpoint = _.find(endpoints, function (endpoint) {
    return _.contains(endpoint.page.route.paths, requestUrl);
  });

  // check if there is a match in the loaded routes for the current pages `route: { paths: ['xx','yy'] }` property
  if (!endpoint) {
    endpoint = _.find(endpoints, function (endpoint) {
      return !_.isEmpty(_.intersection(endpoint.page.route.paths, req.paths));
    });
  }

  return endpoint;
}

/**
 * Retrieves the content-type of the page that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {string}
 */
Cache.prototype.getEndpointContentType = function(req) {
  var endpoint = this.getEndpointMatchingRequest(req);
  return endpoint.page.contentType;
}

/**
 * Initialises a RedisClient using the main configuration settings
 * @returns {RedisClient}
 */
Cache.prototype.initialiseRedisClient = function() {
  return redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
};

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function() {
  var self = this;

  /**
   * Retrieves the page that the requested URL matches
   * @param {IncomingMessage} req - the current HTTP request
   * @returns {object}
   */
  this.server.app.use(function (req, res, next) {
    var enabled = self.cachingEnabled(req);
    if (!enabled) return next();

    // only cache GET requests
    if (req.method && req.method.toLowerCase() !== 'get') return next();

    // we build the filename with a hashed hex string so we can be unique
    // and avoid using file system reserved characters in the name
    var requestUrl = url.parse(req.url, true).path;
    var filename = crypto.createHash('sha1').update(requestUrl).digest('hex');
    var cachepath = path.join(self.dir, filename + '.' + config.get('caching.directory.extension'));

    // allow query string param to bypass cache
    var query = url.parse(req.url, true).query;
    var noCache = query.cache && query.cache.toString().toLowerCase() === 'false';

    // get contentType that current endpoint requires
    var contentType = self.getEndpointContentType(req);

    var readStream;

    if (self.redisClient) {
      self.redisClient.exists(filename, function (err, exists) {
        if (exists > 0) {
          res.setHeader('X-Cache-Lookup', 'HIT');

          if (noCache) {
              res.setHeader('X-Cache', 'MISS');
              return next();
          }

          res.statusCode = 200;
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('Server', config.get('server.name'));
          res.setHeader('Content-Type', contentType);

          readStream = redisRStream(self.redisClient, filename);
          readStream.pipe(res);
        }
        else {
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Lookup', 'MISS');
          return cacheResponse();
        }
      });
    }
    else {
      readStream = fs.createReadStream(cachepath, {encoding: this.encoding});

      readStream.on('error', function (err) {
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Lookup', 'MISS');

          if (!noCache) {
              return cacheResponse();
          }
      });

      var data = '';
      readStream.on('data', function(chunk) {
        if (chunk) data += chunk;
      });

      readStream.on('end', function () {

        if (data === "") {
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Lookup', 'MISS');
          return cacheResponse();
        }

        if (noCache) {
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Lookup', 'HIT');
          return next();
        }

        // check if ttl has elapsed
        try {
          var stats = fs.statSync(cachepath);
          var ttl = self.options.ttl || config.get('caching.ttl');
          var lastMod = stats && stats.mtime && stats.mtime.valueOf();
          if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) {
            res.setHeader('X-Cache', 'MISS');
            res.setHeader('X-Cache-Lookup', 'HIT');
            return cacheResponse();
          }
        }
        catch (err) {

        }

        log.info({module: 'cache'}, 'Serving ' + req.url + ' from cache file (' + cachepath + ')');

        fs.stat(cachepath, function (err, stat) {
          res.statusCode = 200;
          res.setHeader('Server', config.get('server.name'));
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', stat.size);
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Lookup', 'HIT');

          var stream = new Readable();
          stream.push(data);
          stream.push(null);

          stream.pipe(res);
        });
      });
    }

    /**
     * Writes the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings
     */
    function cacheResponse() {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      var _end = res.end;
      var _write = res.write;

      var data = '';

      res.write = function (chunk) {
        _write.apply(res, arguments);
      };

      res.end = function (chunk) {
        // respond before attempting to cache
        _end.apply(res, arguments);

        if (chunk) data += chunk;

        // if response is not 200 don't cache
        if (res.statusCode !== 200) return;

        var stream = new Readable();
        stream.push(data);
        stream.push(null);

        if (self.redisClient) {
          // save to redis
          stream.pipe(redisWStream(self.redisClient, filename)).on('finish', function () {
            if (config.get('caching.ttl')) {
              self.redisClient.expire(filename, config.get('caching.ttl'));
            }
          });
        }
        else {
          // TODO: do we need to grab a lock here?

          var cacheFile = fs.createWriteStream(cachepath, {flags: 'w'});
          stream.pipe(cacheFile);
        }
      };
      return next();
    }
  });
};

// get method for redis client
module.exports.client = function() {
  if (instance) return instance.redisClient;
  return null;
};

// reset method for unit tests
module.exports.reset = function() {
  instance = null;
};

module.exports.delete = function(pattern, callback) {
  var async = require('async');
  var iter = '0';
  pattern = pattern+"*";
  var cacheKeys = [];
  var self = this;

  async.doWhilst(
    function (acb) {
      //scan with the current iterator, matching the given pattern
      self.client().scan(iter, 'MATCH', pattern, function (err, result) {
        if (err) {
          acb(err);
        }
        else {
          //update the iterator
          iter = result[0];
          async.each(result[1],
            //for each key
            function (key, ecb) {
              cacheKeys.push(key);
              return ecb(err);
            },
            function (err) {
              //done with this scan iterator; on to the next
              return acb(err);
            }
          )
        }
      });
    },
    //test to see if iterator is done
    function () { return iter != '0'; },
    //done
    function (err) {
      if (err) {
        console.log("Error:", err);
      }
      else {
        if (cacheKeys.length === 0) {
          return callback(null);
        }

        var i = 0;
        _.each(cacheKeys, function(key) {
          self.client().del(key, function (err, result) {
            i++;
            // finished, all keys deleted
            if (i === cacheKeys.length) {
              return callback(null);
            }
          });
        });
      }
    }
  );
}