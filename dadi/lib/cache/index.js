/**
 * @module Cache
 */
var _ = require('underscore')
var crypto = require('crypto')
var path = require('path')
var url = require('url')

var config = require(path.join(__dirname, '/../../../config.js'))
var log = require('@dadi/logger')

var DadiCache = require('@dadi/cache')

/**
 * Creates a new Cache instance for the server
 * @constructor
 * @param {Server} server - the main server instance
 */
var Cache = function (server) {
  this.server = server
  this.cache = new DadiCache(config.get('caching'))

  Cache.numInstances = (Cache.numInstances || 0) + 1
  // console.log('Cache:', Cache.numInstances)

  var directoryEnabled = config.get('caching.directory.enabled')
  var redisEnabled = config.get('caching.redis.enabled')

  this.enabled = !(directoryEnabled === false && redisEnabled === false)
  this.encoding = 'utf8'
  this.options = {}
}

var instance
module.exports = function (server) {
  if (!instance) {
    instance = new Cache(server)
  }
  return instance
}

/**
 * Determines whether caching is enabled by testing the main configuration setting and
 * the cache setting for the page that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {Boolean}
 */
Cache.prototype.cachingEnabled = function (req) {
  var query = url.parse(req.url, true).query
  if (query.json && query.json !== 'false') {
    return false
  }

  if (config.get('debug')) {
    return false
  }

  var endpoint = this.getEndpointMatchingRequest(req)

  if (!endpoint) {
    endpoint = this.getEndpointMatchingLoadedPaths(req)
  }

  // not found in the loaded routes, let's not bother caching
  if (!endpoint) return false

  if (endpoint.page && endpoint.page.settings) {
    this.options = endpoint.page.settings
  } else {
    this.options.cache = false
  }

  return (this.enabled && (this.options.cache || false))
}

/**
 * Retrieves the page component that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {object}
 */
Cache.prototype.getEndpointMatchingRequest = function (req) {
  var endpoints = this.server.components
  var requestUrl = url.parse(req.url, true).pathname

  // check if there is a match in the loaded routes for the current request URL
  var endpoint = _.find(endpoints, (endpoint) => {
    return _.contains(_.pluck(endpoint.page.routes, 'path'), requestUrl)
  })

  return endpoint
}
/**
 * Retrieves the page component that best matches the paths loaded in api/index.js
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {object}
 */
Cache.prototype.getEndpointMatchingLoadedPaths = function (req) {
  var endpoints = this.server.components

  // check if there is a match in the loaded routes for the current pages `route:
  // e.g. { paths: ['xx','yy'] }` property
  return _.find(endpoints, (endpoint) => {
    return !_.isEmpty(_.intersection(_.pluck(endpoint.page.routes, 'path'), req.paths))
  })
}

/**
 * Retrieves the content-type of the page that the requested URL matches
 * @param {IncomingMessage} req - the current HTTP request
 * @returns {string}
 */
Cache.prototype.getEndpointContentType = function (req) {
  var endpoint = this.getEndpointMatchingRequest(req)

  if (!endpoint) {
    endpoint = this.getEndpointMatchingLoadedPaths(req)
  }

  return endpoint.page.contentType
}

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function () {
  var self = this

  /**
   * Retrieves the page that the requested URL matches
   * @param {IncomingMessage} req - the current HTTP request
   * @returns {object}
   */
  this.server.app.use(function (req, res, next) {
    var enabled = self.cachingEnabled(req)
    if (!enabled) return next()

    // only cache GET requests
    if (req.method && req.method.toLowerCase() !== 'get') return next()

    // we build the filename with a hashed hex string so we can be unique
    // and avoid using file system reserved characters in the name
    var requestUrl = url.parse(req.url, true).path
    var filename = crypto.createHash('sha1').update(requestUrl).digest('hex')

    // allow query string param to bypass cache
    var query = url.parse(req.url, true).query
    var noCache = query.cache && query.cache.toString().toLowerCase() === 'false'

    // get contentType that current endpoint requires
    var contentType = self.getEndpointContentType(req)

    // attempt to get from the cache
    self.cache.get(filename).then((stream) => {
      log.info({module: 'cache'}, 'Serving ' + req.url + ' from cache')

      res.setHeader('X-Cache-Lookup', 'HIT')

      if (noCache) {
        res.setHeader('X-Cache', 'MISS')
        return next()
      }

      res.statusCode = 200
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Server', config.get('server.name'))
      res.setHeader('Content-Type', contentType)
      //   res.setHeader('Content-Length', stat.size)

      // send cached content back
      stream.pipe(res)
    }).catch(() => {
      // not found in cache
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('X-Cache-Lookup', 'MISS')
      return cacheResponse()
    })

    /**
     * Writes the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings
     */
    function cacheResponse () {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      var _end = res.end
      var _write = res.write

      var data = ''

      res.write = function (chunk) {
        _write.apply(res, arguments)
      }

      res.end = function (chunk) {
        // respond before attempting to cache
        _end.apply(res, arguments)

        if (chunk) data += chunk

        // if response is not 200 don't cache
        if (res.statusCode !== 200) return

        // cache the content
        self.cache.set(filename, data).then(() => {

        })
      }
      return next()
    }
  })
}

// get method for redis client
module.exports.client = function () {
  // if (instance) return instance.redisClient
  return null
}

// reset method for unit tests
module.exports.reset = function () {
  instance = null
}

module.exports.delete = function (pattern, callback) {
  var async = require('async')
  var iter = '0'
  pattern = pattern + '*'
  var cacheKeys = []
  var self = this

  async.doWhilst(
    function (acb) {
      // scan with the current iterator, matching the given pattern
      self.client().scan(iter, 'MATCH', pattern, function (err, result) {
        if (err) {
          acb(err)
        } else {
          // update the iterator
          iter = result[0]
          async.each(result[1],
            // for each key
            function (key, ecb) {
              cacheKeys.push(key)
              return ecb(err)
            },
            function (err) {
              // done with this scan iterator; on to the next
              return acb(err)
            }
          )
        }
      })
    },
    // test to see if iterator is done
    function () { return iter !== '0' },
    // done
    function (err) {
      if (err) {
        console.log('Error:', err)
      } else {
        if (cacheKeys.length === 0) {
          return callback(null)
        }

        var i = 0
        _.each(cacheKeys, function (key) {
          self.client().del(key, function (err, result) {
            if (err) console.log(err)
            i++
            // finished, all keys deleted
            if (i === cacheKeys.length) {
              return callback(null)
            }
          })
        })
      }
    }
  )
}
