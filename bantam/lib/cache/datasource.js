var fs = require('fs');
var path = require('path');
var url = require('url');
var crypto = require('crypto');

var config = require(__dirname + '/../../../config');

var cacheEncoding = 'utf8';
var options = {};

var DatasourceCache = function (datasource) {
  this.datasource = datasource;
};

DatasourceCache.prototype.cachingEnabled = function() {
  var enabled = config.caching.enabled && this.datasource.schema.datasource.caching && this.datasource.schema.datasource.caching.enabled;
  if (typeof enabled === 'undefined') {
    return false;
  }
  return enabled;
};

DatasourceCache.prototype.getFromCache = function () {

  if (!this.cachingEnabled()) {
    return false;
  }

  // we build the filename with a hashed hex string so we can be unique
  // and avoid using file system reserved characters in the name
  var filename = crypto.createHash('sha1').update(this.datasource.endpoint).digest('hex');
  this.cachepath = path.join(this.datasource.schema.datasource.caching.directory, filename + '.' + this.datasource.schema.datasource.caching.extension);

  var self = this;
  fs.stat(this.cachepath, function (err, stats) {
      if (err) {
          if (err.code === 'ENOENT') {
              return false;
          }
          return next(err);
      }

      // check if ttl has elapsed
      var ttl = options.ttl || config.caching.ttl;
      var lastMod = stats && stats.mtime && stats.mtime.valueOf();
      if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) return false;

      fs.readFile(self.cachepath, {encoding: cacheEncoding}, function (err, body) {
        return body;
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
