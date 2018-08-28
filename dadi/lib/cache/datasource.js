/**
 * @module Cache
 */
const crypto = require('crypto')
const debug = require('debug')('web:datasource-cache')
const merge = require('deepmerge')
const path = require('path')
const url = require('url')

const Cache = require(path.join(__dirname, '/index.js'))
const config = require(path.join(__dirname, '/../../../config.js'))
const log = require('@dadi/logger')

/**
 * Creates a new DatasourceCache singleton for caching datasource results
 * @constructor
 */
const DatasourceCache = function () {
  this.cacheOptions = config.get('caching')
  this.cache = Cache().cache

  const directoryEnabled = this.cacheOptions.directory.enabled
  const redisEnabled = this.cacheOptions.redis.enabled

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

  const filename = this.getFilename(opts)
  const options = this.getOptions(opts)

  const buffers = []

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
  const enabled = this.cachingEnabled(opts)

  if (!enabled) {
    return done(false)
  }

  if (this.stillCaching) {
    return done(false)
  }

  debug('write to cache (%s)', opts.name)

  const filename = this.getFilename(opts)
  const options = this.getOptions(opts)

  this.stillCaching = true

  this.cache
    .set(filename, data, options)
    .then(() => {
      this.stillCaching = false
      return done(true)
    })
    .catch(err => {
      log.info('datasource cache fail: ', err)
    })
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
DatasourceCache.prototype.cachingEnabled = function (opts) {
  let enabled = this.enabled

  // check the querystring for a no cache param
  if (typeof opts.endpoint !== 'undefined') {
    const query = url.parse(opts.endpoint, true).query
    if (query.cache && query.cache === 'false') {
      enabled = false
    }
  }

  if (config.get('debug')) {
    enabled = false
  }

  const options = this.getOptions(opts)

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
  let filename = crypto
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
  const options = merge(this.cacheOptions, opts.caching || {})

  options.directory.extension = 'json'

  return options
}

module.exports._reset = function () {}

module.exports = function () {
  return new DatasourceCache()
}
