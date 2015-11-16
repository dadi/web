var fs = require('fs');
var path = require('path');
var url = require('url');
var crypto = require('crypto');

var config = require(__dirname + '/../../../config.js');

var cacheEncoding = 'utf8';
var options = {};

var DatasourceCache = function (datasource) {
  this.datasource = datasource;

  if (this.datasource.schema.datasource.caching) {
    options = this.datasource.schema.datasource.caching;
  }
};

DatasourceCache.prototype.cachingEnabled = function() {
  var enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');

  if (typeof enabled === 'undefined') {
    return false;
  }

  if (config.get('debug')) {
    return false;
  }

  if (this.datasource.source.type === 'static') {
    return false;
  }

  var query = url.parse(this.datasource.endpoint, true).query;
  if (query.hasOwnProperty('cache') && query.cache === 'false') {
    enabled = false;
  }

  return enabled;
};

DatasourceCache.prototype.getFromCache = function (done) {

  if (!this.cachingEnabled()) {
    return done(false);
  }

  // we build the filename with a hashed hex string so we can be unique
  // and avoid using file system reserved characters in the name
  var filename = crypto.createHash('sha1').update(this.datasource.endpoint).digest('hex');
  this.cachepath = path.join(this.datasource.schema.datasource.caching.directory, filename + '.' + this.datasource.schema.datasource.caching.extension);

  var self = this;
  fs.stat(this.cachepath, function (err, stats) {
      if (err) {
          if (err.code === 'ENOENT') {
              return done(false);
          }
          return done(false);
      }

      // check if ttl has elapsed
      var ttl = options.ttl || config.get('caching.ttl');
      var lastMod = stats && stats.mtime && stats.mtime.valueOf();

      if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) return done(false);

      fs.readFile(self.cachepath, {encoding: cacheEncoding}, function (err, body) {
        return done(body);
      });
  });
};

DatasourceCache.prototype.cacheResponse = function(data) {
  // TODO: do we need to grab a lock here?
  if (!this.cachingEnabled()) return;

  fs.writeFile(this.cachepath, data, {encoding: cacheEncoding}, function (err) {
      if (err) console.log(err.toString());
  });
}

module.exports = function (datasource) {
  return new DatasourceCache(datasource);
};

module.exports.DatasourceCache = DatasourceCache;
