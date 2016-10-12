/**
 * @module Cache
 */
var _ = require('underscore')
var path = require('path')
var url = require('url')
var crypto = require('crypto')
var s = require('underscore.string')

var mainCache = require(path.join(__dirname, '/index.js'))
var config = require(path.join(__dirname, '/../../../config.js'))
var log = require('@dadi/logger')

var DadiCache = require('@dadi/cache')

/**
 * Creates a new DatasourceCache instance for the specified datasource.
 * @constructor
 * @param {object} datasource - a datasource schema object containing the datasource settings
 */
var DatasourceCache = function (datasource) {
  this.datasource = datasource

  this.mainCache = mainCache()
  this.options = this.datasource.schema.datasource.caching || {}

  // enabled if main cache module is enabled and this is not a static datasource
  this.enabled = this.mainCache.enabled && this.datasource.source.type !== 'static'

  // we build the filename with a hashed hex string so we can be unique
  // and avoid using file system reserved characters in the name, but not
  // all datasource providers work with url endpoints so we allow the use of
  // a unique cacheKey instead
  this.filename = crypto.createHash('sha1').update(this.datasource.name).digest('hex')

  if (this.datasource.provider.cacheKey) {
    this.filename += '_' + crypto.createHash('sha1').update(this.datasource.provider.cacheKey).digest('hex')
  } else {
    this.filename += '_' + crypto.createHash('sha1').update(this.datasource.provider.endpoint).digest('hex')
  }

  if (_.isEmpty(this.options)) {
    this.options = config.get('caching')
  }

  if (!this.options.directory || s.isBlank(this.options.directory.path)) {
    this.options.directory = {
      path: config.get('caching.directory.path')
    }
  }

  if (!this.options.directory.extension || s.isBlank(this.options.directory.extension)) {
    this.options.directory.extension = '.json'
  }

  this.cache = new DadiCache(this.options)
}

// DatasourceCache.prototype.setCachePath = function () {
//   var cachePath = '.'
//   var defaultExtension = '.json'
//
//   // if the datasource file defines a directory and extension, use those, otherwise
//   // fallback to using the main cache module settings
//   if (!s.isBlank(this.options.directory) && !s.isBlank(this.options.extension)) {
//     cachePath = path.join(this.options.directory, this.filename + '.' + this.options.extension)
//   } else {
//     cachePath = path.join(this.mainCache.dir, this.filename + defaultExtension)
//   }
//
//   this.cachepath = cachePath
// }

/**
 *
 */
DatasourceCache.prototype.cachingEnabled = function () {
  var enabled = this.enabled || false

  // check the querystring for a no cache param
  if (typeof this.datasource.provider.endpoint !== 'undefined') {
    var query = url.parse(this.datasource.provider.endpoint, true).query
    if (query.cache && query.cache === 'false') {
      enabled = false
    }
  }

  if (config.get('debug')) {
    enabled = false
  }

  // enabled if the datasource caching block says it's enabled
  return enabled && (this.options.directory.enabled || this.options.redis.enabled)
}

/**
 *
 */
DatasourceCache.prototype.getFromCache = function (done) {
  if (!this.cachingEnabled()) {
    return done(false)
  }

  var data = ''

  // attempt to get from the cache
  this.cache.get(this.filename).then((stream) => {
    log.info({module: 'cache'}, 'Serving datasource from Redis (' + this.datasource.name + ', ' + this.filename + ')')

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
DatasourceCache.prototype.cacheResponse = function (data, done) {
  if (!this.cachingEnabled()) return

  this.cache.set(this.filename, data).then(() => {
    done()
  })
}

module.exports = function (datasource) {
  return new DatasourceCache(datasource)
}

module.exports.DatasourceCache = DatasourceCache
