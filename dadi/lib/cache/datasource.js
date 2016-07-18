/**
 * @module Cache
 */
var fs = require('fs');
var path = require('path');
var url = require('url');
var crypto = require('crypto');
var redis = require('redis');
var redisRStream = require('redis-rstream');
var redisWStream = require('redis-wstream');
var Readable = require('stream').Readable;
var s = require('underscore.string');

var cache = require(__dirname + '/index.js');
var config = require(__dirname + '/../../../config.js');
var log = require(__dirname + '/../log');

var cacheEncoding = 'utf8';
var options = {};

/**
 * Creates a new DatasourceCache instance for the specified datasource.
 * @constructor
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
var DatasourceCache = function (datasource) {
  this.datasource = datasource;

  this.cache = cache();
  this.options = this.datasource.schema.datasource.caching || {};

  // enabled if main cache module is enabled and this is not a static datasource
  this.enabled = this.cache.enabled && this.datasource.source.type !== 'static';

  // we build the filename with a hashed hex string so we can be unique
  // and avoid using file system reserved characters in the name
  console.log('CACHE'.red, this.datasource)
  console.log('endpoint'.red, this.datasource.provider.endpoint)

  var name = this.datasource.name
  var endpoint = this.datasource.provider.endpoint || ''
  this.filename = crypto.createHash('sha1').update(name).digest('hex') + '_' + crypto.createHash('sha1').update(endpoint).digest('hex');

  this.setCachePath();

  var self = this;
};

DatasourceCache.prototype.setCachePath = function() {
  var cachePath = '.';

  // if the datasource file defines a directory and extension, use those, otherwise
  // fallback to using the main cache module settings
  if (!s.isBlank(this.options.directory) && !s.isBlank(this.options.extension)) {
    cachePath = path.join(this.options.directory, this.filename + '.' + this.options.extension);
  }
  else {
    cachePath = path.join(this.cache.dir, this.filename + '.json');
  }

  this.cachepath = cachePath;
};

DatasourceCache.prototype.cachingEnabled = function() {

  var enabled = this.enabled || false;

  if (!this.cachepath) enabled = false;

  // check the querystring for a no cache param
  var query = url.parse(this.datasource.provider.endpoint, true).query;
  if (query.cache && query.cache === 'false' || config.get('debug')) {
    enabled = false;
  }

  // enabled if the datasource caching block says it's enabled
  return enabled && this.options.enabled;
};

DatasourceCache.prototype.getFromCache = function (done) {

  if (!this.cachingEnabled()) {
    return done(false);
  }

  var self = this;
  var readStream, data = '';

  if (self.cache.redisClient) {
    self.cache.redisClient.exists(self.filename, function (err, exists) {

      if (exists > 0) {
        readStream = redisRStream(self.cache.redisClient, self.filename);

        if (!readStream) {
          return done(false);
        }

        readStream.on('error', function (err) {
          return done(false);
        });

        readStream.on('data', function (chunk) {
          if (chunk) data += chunk;
        });

        readStream.on('end', function () {
          log.info({module: 'cache'}, 'Serving datasource from Redis (' + self.datasource.name + ', ' + self.filename + ')');

          return done(data);
        });
      }
      else {
        return done(false);
      }
    });
  }
  else {
    readStream = fs.createReadStream(self.cachepath, {encoding: self.encoding});

    if (!readStream) {
      return done(false);
    }

    readStream.on('error', function (err) {
      return done(false);
    });

    readStream.on('data', function (chunk) {
      if (chunk) data += chunk;
    });

    readStream.on('end', function () {
      // check if ttl has elapsed
      var stats = fs.statSync(self.cachepath);
      var ttl = self.options.ttl || config.get('caching.ttl');
      var lastMod = stats && stats.mtime && stats.mtime.valueOf();
      if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) {
         return done(false);
      }

      log.info({module: 'cache'}, 'Serving datasource from cache file (' + self.datasource.name + ', ' + self.cachepath + ')');

      return done(data);
    });

  }
};

DatasourceCache.prototype.cacheResponse = function(data, done) {
  // TODO: do we need to grab a lock here?
  if (!this.cachingEnabled()) return;

  var self = this;

  var readStream = new Readable();

  readStream.push(data);
  readStream.push(null);

  if (self.cache.redisClient) {
    // save to redis
    readStream.pipe(redisWStream(self.cache.redisClient, self.filename)).on('finish', function () {
      var ttl = self.options.ttl || config.get('caching.ttl');
      if (config.get('caching.ttl')) {
        self.cache.redisClient.expire(self.filename, ttl);
      }
    });
  }
  else {
    var cacheFile = fs.createWriteStream(self.cachepath, {flags: 'w'});
    readStream.pipe(cacheFile);
  }

  done();
};

module.exports = function (datasource) {
  return new DatasourceCache(datasource);
};

module.exports.DatasourceCache = DatasourceCache;
