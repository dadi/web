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

var Cache = function(server) {

    this.log = log.get().child({module: 'cache'});
    this.log.info('Cache logging started.');

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
            if (err) self.log.error(err);
            if (made) self.log.info('Created cache directory ' + made);
        });
    }
    else if (config.get('caching.redis.enabled')) {
        self.redisClient = self.initialiseRedisClient();

        self.redisClient.on("error", function (err) {
            this.log.error(err);
        });
    }
};

var instance;
module.exports = function(server) {
  //console.log(server);
  //console.log(instance);
  if (!instance) {
    instance = new Cache(server);
  }
  return instance;
};

Cache.prototype.cachingEnabled = function(req) {

    var query = url.parse(req.url, true).query;
    if (query.hasOwnProperty('json') && query.json !== 'false') {
      return false;
    }

    if (config.get('debug')) {
      return false;
    }

    var endpoints = this.server.components;
    var requestUrl = url.parse(req.url, true).pathname;

    // check if there is a match in the loaded routes for the current pages `route: { paths: ['xx','yy'] }` property
    var endpoint = _.find(endpoints, function (endpoint){ return !_.isEmpty(_.intersection(endpoint.page.route.paths, req.paths)); });

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

Cache.prototype.initialiseRedisClient = function() {
    return redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
};

Cache.prototype.init = function() {

    var self = this;

    this.server.app.use(function (req, res, next) {

        help.timer.start('cache - check enabled');

        var enabled = self.cachingEnabled(req);

        help.timer.stop('cache - check enabled');

        if (!enabled) return next();

        // only cache GET requests
        if (req.method && req.method.toLowerCase() !== 'get') return next();

        // we build the filename with a hashed hex string so we can be unique
        // and avoid using file system reserved characters in the name
        var requestUrl = url.parse(req.url, true).pathname;
        var filename = crypto.createHash('sha1').update(requestUrl).digest('hex');
        var cachepath = path.join(self.dir, filename + '.' + config.get('caching.directory.extension'));

        // allow query string param to bypass cache
        var query = url.parse(req.url, true).query;
        var noCache = query.cache && query.cache.toString().toLowerCase() === 'false';

        var readStream;

        help.timer.start('cache - find');

        if (self.redisClient) {

            self.redisClient.exists(filename, function (err, exists) {
                if (exists > 0) {

                    res.setHeader('X-Cache-Lookup', 'HIT');

                    if (noCache) {
                        //console.log('noCache');
                        res.setHeader('X-Cache', 'MISS');
                        return next();
                    }

                    res.setHeader('X-Cache', 'HIT');

                    res.statusCode = 200;
                    res.setHeader('Server', config.get('server.name'));
                    res.setHeader('Content-Type', 'text/html');

                    help.timer.stop('cache - find');
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
                      console.log('lastMod');
                      res.setHeader('X-Cache', 'MISS');
                      res.setHeader('X-Cache-Lookup', 'HIT');
                      return cacheResponse();
                  }
              }
              catch (err) {

              }

              self.log.info('Serving ' + req.url + ' from cache file (' + cachepath + ')');
              help.timer.stop('cache - find');

              fs.stat(cachepath, function (err, stat) {
                res.statusCode = 200;
                res.setHeader('Server', config.get('server.name'));
                res.setHeader('Content-Type', 'text/html');
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

        function cacheResponse() {

            help.timer.start('cache - store');

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
                    self.redisClient.on("error", function (err) {
                        self.log.error(err);
                    });

                    // save to redis
                    stream.pipe(redisWStream(self.redisClient, filename)).on('finish', function () {
                        if (config.get('caching.ttl')) {
                            self.redisClient.expire(filename, config.get('caching.ttl'));
                        }
                        help.timer.stop('cache - store');
                    });
                }
                else {
                    // TODO: do we need to grab a lock here?

                    var cacheFile = fs.createWriteStream(cachepath, {flags: 'w'});
                    stream.pipe(cacheFile);

                    help.timer.stop('cache - store');
                }
            };
            return next();
        }
    });
};

// reset method for unit tests
module.exports.reset = function() {
  instance = null;
};
