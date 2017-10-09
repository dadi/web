/**
 * @module Cache
 */
var crypto = require('crypto')
var debug = require('debug')('web:datasource-cache')
var merge = require('deepmerge')
var path = require('path')
var url = require('url')

var Cache = require(path.join(__dirname, '/index.js'))
var config = require(path.join(__dirname, '/../../../config.js'))
var log = require('@dadi/logger')

/**
 * Creates a new DatasourceCache singleton for caching datasource results
 * @constructor
 */
var DatasourceCache = function () {
  this.cacheOptions = config.get('caching')
  this.cache = Cache().cache

  var directoryEnabled = this.cacheOptions.directory.enabled
  var redisEnabled = this.cacheOptions.redis.enabled

  this.enabled = !(directoryEnabled === false && redisEnabled === false)
}

/**
 * Get datasource data from the cache if it exists
 * @param {object} datasource - a datasource schema object containing the datasource settings
 * @param {fn} done - the method to call when finished, accepts 1 arg:
 *   if the cache key was found, returns {Buffer} data
 *   if the cache key was not found, returns false
 */
DatasourceCache.prototype.getFromCache = function (opts, done) {
  debug('get (%s)', opts.name)

  if (!this.cachingEnabled(opts)) {
    return done(false)
  }

  if (this.stillCaching) {
    return done(false)
  }

  var filename = this.getFilename(opts)
  var options = this.getOptions(opts)

  var buffers = []

  // attempt to get from the cache
  this.cache
    .get(filename, options)
    .then(stream => {
      debug('serving %s from cache (%s)', opts.name, filename)
      log.info('serving %s from cache (%s)', opts.name, filename)

      stream.on('data', chunk => {
        if (chunk) {
          buffers.push(chunk)
        }
      })

      stream.on('end', () => {
        return done(Buffer.concat(buffers))
      })
    })
    .catch(() => {
      // key doesn't exist in cache
      return done(false)
    })
}

/**
 * Cache the supplied data it caching is enabled for the datasource
 *
 * @param  {Object} datasource - the datasource instance
 * @param  {Buffer} data - the body of the response as a Buffer
 * @param  {fn} done - the method to call when finished, accepts args (Boolean written)
 */
DatasourceCache.prototype.cacheResponse = function (opts, data, done) {
  var enabled = this.cachingEnabled(opts)

  if (!enabled) {
    return done(false)
  }

  if (this.stillCaching) {
    // console.log('stillCaching...')
    return done(false)
  }

  debug('write to cache (%s)', opts.name)

  var filename = this.getFilename(opts)
  var options = this.getOptions(opts)

  // console.log('> CACHE RESPONSE')
  // console.log('is Buffer?', Buffer.isBuffer(data))
  // console.log(filename, opts.endpoint)

  this.stillCaching = true

  this.cache.set(filename, data, options).then(() => {
    // console.log('< CACHE RESPONSE', filename)
    this.stillCaching = false
    return done(true)
  })
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
DatasourceCache.prototype.cachingEnabled = function (opts) {
  var enabled = this.enabled

  // check the querystring for a no cache param
  if (typeof opts.endpoint !== 'undefined') {
    var query = url.parse(opts.endpoint, true).query
    if (query.cache && query.cache === 'false') {
      enabled = false
    }
  }

  // if (datasource.source.type === 'static') {
  //   enabled = false
  // }

  if (config.get('debug')) {
    enabled = false
  }

  var options = this.getOptions(opts)

  debug('options (%s): %o', opts.name, options)

  // enabled if the datasource caching block says it's enabled
  return enabled && (options.directory.enabled || options.redis.enabled)
}

/**
 * Construct the file cache key
 * We build the filename with a hashed hex string so we can be unique
 * and avoid using file system reserved characters in the name, but not
 * all datasource providers work with url endpoints so we allow the use of
 * a unique cacheKey instead
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
DatasourceCache.prototype.getFilename = function (opts) {
  var filename = crypto
    .createHash('sha1')
    .update(opts.name)
    .digest('hex')

  if (opts.cacheKey) {
    filename +=
      '_' +
      crypto
        .createHash('sha1')
        .update(opts.cacheKey)
        .digest('hex')
  } else {
    filename +=
      '_' +
      crypto
        .createHash('sha1')
        .update(opts.endpoint)
        .digest('hex')
  }

  return filename
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 * @returns {object} options for the cache
 */
DatasourceCache.prototype.getOptions = function (opts) {
  var options = merge(this.cacheOptions, opts.caching || {})

  options.directory.extension = 'json'

  return options
}

module.exports._reset = function () {}

module.exports = function () {
  return new DatasourceCache()
}
