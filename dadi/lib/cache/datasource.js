/**
 * @module Cache
 */
var _ = require('underscore')
var path = require('path')
var url = require('url')
var crypto = require('crypto')
var s = require('underscore.string')

var config = require(path.join(__dirname, '/../../../config.js'))
var log = require('@dadi/logger')

var DadiCache = require('@dadi/cache')

/**
 * Creates a new DatasourceCache singleton for caching datasource results
 * @constructor
 */
var DatasourceCache = function () {
  this.cacheOptions = config.get('caching')

  var directoryEnabled = this.cacheOptions.directory.enabled
  var redisEnabled = this.cacheOptions.redis.enabled

  this.enabled = !(directoryEnabled === false && redisEnabled === false)
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
DatasourceCache.prototype.cachingEnabled = function (datasource) {
  var enabled = this.enabled

  // check the querystring for a no cache param
  if (typeof datasource.provider.endpoint !== 'undefined') {
    var query = url.parse(datasource.provider.endpoint, true).query
    if (query.cache && query.cache === 'false') {
      enabled = false
    }
  }

  if (datasource.source.type === 'static') {
    enabled = false
  }

  if (config.get('debug')) {
    enabled = false
  }

  var options = this.getOptions(datasource)

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
DatasourceCache.prototype.getFilename = function (datasource) {
  var filename = crypto.createHash('sha1').update(datasource.name).digest('hex')

  if (datasource.provider.cacheKey) {
    filename += '_' + crypto.createHash('sha1').update(datasource.provider.cacheKey).digest('hex')
  } else {
    filename += '_' + crypto.createHash('sha1').update(datasource.provider.endpoint).digest('hex')
  }

  return filename
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 * @returns {object} options for the cache
 */
DatasourceCache.prototype.getOptions = function (datasource) {
  var options = datasource.schema.datasource.caching || {}

  options = _.extend(this.cacheOptions, options)

  if (!options.directory || s.isBlank(options.directory.path)) {
    options.directory = {
      path: config.get('caching.directory.path')
    }
  }

  options.directory.extension = 'json'

  return options
}

/**
 *
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
DatasourceCache.prototype.getFromCache = function (datasource, done) {
  if (!this.cachingEnabled(datasource)) {
    return done(false)
  }

  var filename = this.getFilename(datasource)
  var options = this.getOptions(datasource)
  var cache = new DadiCache(options)

  var data = ''

  // attempt to get from the cache
  cache.get(filename).then((stream) => {
    log.info({module: 'cache'}, 'Serving datasource from Redis (' + datasource.name + ', ' + filename + ')')

    stream.on('data', (chunk) => {
      if (chunk) data += chunk
    })

    stream.on('end', () => {
      return done(data)
    })
  }).catch(() => {
    // key doesn't exist in cache
    return done(false)
  })
}

/**
 *
 */
DatasourceCache.prototype.cacheResponse = function (datasource, data, done) {
  if (!this.cachingEnabled(datasource)) return

  var filename = this.getFilename(datasource)
  var options = this.getOptions(datasource)
  var cache = new DadiCache(options)

  cache.set(filename, data).then(() => {
    done()
  })
}

var instance

module.exports = function () {
  if (!instance) {
    instance = new DatasourceCache()
  }

  return instance
}

module.exports._reset = function () {
  instance = null
}

module.exports.DatasourceCache = DatasourceCache
