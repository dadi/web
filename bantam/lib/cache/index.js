var crypto = require('crypto');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var redis = require('redis');
var redisRStream = require('redis-rstream');
var url = require('url');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var log = require(__dirname + '/../log');

var cacheEncoding = 'utf8';
var options = {};

var configEnabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');
var dir = config.get('caching.directory.path');
var redisClient = null;

var self = this;

function cachingEnabled(endpoints, requestUrl) {

    requestUrl = url.parse(requestUrl, true).pathname;
    var endpointKey = _.find(_.keys(endpoints), function (k){ return k.indexOf(requestUrl) > -1; });
    
    if (!endpointKey) return false;

    if (endpoints[endpointKey].page && endpoints[endpointKey].page.settings) {
        options = endpoints[endpointKey].page.settings;
    }

    return (configEnabled && options.cache);
}

function initialiseRedisClient() {
    return redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
}

module.exports = function (server) {

    if (config.get('caching.directory.enabled')) {
        console.log('DIR');
        // create cache directory if it doesn't exist
        mkdirp(dir, {}, function (err, made) {
            if (err) log.error('[CACHE] ' + err);
            if (made) log.info('[CACHE] Created cache directory ' + made);
        });
    }
    else if (config.get('caching.redis.enabled')) {
        self.redisClient = initialiseRedisClient();

        self.redisClient.on("error", function (err) {
            log.error(err);
        });
    }

    server.app.use(function (req, res, next) {

        if (!cachingEnabled(server.components, req.url)) return next();

        // only cache GET requests
        if (!(req.method && req.method.toLowerCase() === 'get')) return next();

        // we build the filename with a hashed hex string so we can be unique
        // and avoid using file system reserved characters in the name
        var filename = crypto.createHash('sha1').update(req.url).digest('hex');
        var cachepath = path.join(dir, filename + '.' + config.get('caching.directory.extension'));

        // allow query string param to bypass cache
        var query = url.parse(req.url, true).query;
        var noCache = query.cache && query.cache.toString().toLowerCase() === 'false';

        if (self.redisClient) {
            console.log('HERE');
            self.redisClient.exists(filename, function (err, exists) {
                if (exists > 0) {

                    res.setHeader('X-Cache-Lookup', 'HIT');

                    if (noCache) {
                        res.setHeader('X-Cache', 'MISS');
                        return next();
                    }
                    
                    res.setHeader('X-Cache', 'HIT');
                    
                    var readStream = redisRStream(this.client, filename);
                    readStream.pipe(res);
                }
                else {
                    res.setHeader('X-Cache', 'MISS');
                    res.setHeader('X-Cache-Lookup', 'MISS');
                    return cacheResponse();
                }
            });
        }

        fs.stat(cachepath, function (err, stats) {

            if (err) {
                if (err.code === 'ENOENT') {
                    res.setHeader('X-Cache', 'MISS');
                    res.setHeader('X-Cache-Lookup', 'MISS');
                    return cacheResponse();
                }
                return next(err);
            }

            if (noCache) {
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Lookup', 'HIT');
                return next();
            }

            // check if ttl has elapsed
            var ttl = options.ttl || config.get('caching.ttl');
            var lastMod = stats && stats.mtime && stats.mtime.valueOf();

            if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) return cacheResponse();

            fs.readFile(cachepath, {encoding: cacheEncoding}, function (err, resBody) {
                if (err) return next(err);

                // there are only two possible types javascript or json
                //var dataType = query.callback ? 'text/javascript' : 'application/json';
                
                console.log(cachepath);

                var dataType = 'text/html';

                res.statusCode = 200;

                res.setHeader('Server', config.get('app.name'));
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Lookup', 'HIT');
                res.setHeader('content-type', dataType);
                res.setHeader('content-length', Buffer.byteLength(resBody));

                res.end(resBody);
            });
        });

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

                console.log(self.redisClient);
                if (self.redisClient) {
                    self.redisClient.on("error", function (err) {
                        log.error(err);
                    });

                    var Readable = require('stream').Readable;
                    var s = new Readable();
                    s.push(data);
                    s.push(null);

                    // save to redis
                    s.pipe(redisWStream(self.redisClient, filename)).on('finish', function () {
                        if (config.get('caching.ttl')) {
                            self.redisClient.expire(filename, config.get('caching.ttl'));
                        }
                    });
                }
                
                // TODO: do we need to grab a lock here?
                fs.writeFile(cachepath, data, {encoding: cacheEncoding}, function (err) {
                    if (err) log.error(err.toString());
                });
            };
            return next();
        }
    });
};
