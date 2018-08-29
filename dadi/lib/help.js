'use strict'

/**
 * @module Help
 */
const crypto = require('crypto')
const debug = require('debug')('web:timer')
const fs = require('fs')
const getValue = require('get-value')
const path = require('path')
const perfy = require('perfy')

const version = require('../../package.json').version
const config = require(path.join(__dirname, '/../../config.js'))
const errorView = require(path.join(__dirname, '/debug/views')).error
const Send = require(path.join(__dirname, '/view/send'))

module.exports.getVersion = function () {
  return version
}

module.exports.timer = {
  isDebugEnabled: function isDebugEnabled () {
    return config.get('allowDebugView')
  },

  start: function start (key) {
    if (!this.isDebugEnabled()) return
    debug('start: %s', key)
    perfy.start(key, false)
  },

  stop: function stop (key) {
    if (!this.isDebugEnabled()) return
    debug('stop: %s', key)
    if (perfy.exists(key)) perfy.end(key)
  },

  getStats: function getStats () {
    if (!this.isDebugEnabled()) return
    const stats = {}

    perfy.names().forEach(key => {
      if (perfy.result(key)) {
        stats[key] = perfy.result(key)
        delete stats[key].name
        delete stats[key].summary
      }
    })

    stats.total =
      Object.keys(stats)
        .reduce((total, current) => total + stats[current].time, 0)
        .toFixed(3) + ' seconds'

    perfy.destroyAll()
    return stats
  }
}

/**
 * Checks for valid client credentials in the request body
 * @param {req} req - the HTTP request
 * @param {res} res - the HTTP response
 */
module.exports.validateRequestCredentials = function (req, res) {
  const authConfig = config.get('auth')
  const clientId = req.body.clientId
  const secret = req.body.secret

  if (!clientId || !secret) {
    res.statusCode = 401
    res.end()
    return false
  } else if (clientId !== authConfig.clientId || secret !== authConfig.secret) {
    res.statusCode = 401
    res.end()
    return false
  } else {
    return true
  }
}

/**
 * Checks for valid HTTP method
 * @param {req} req - the HTTP request
 * @param {res} res - the HTTP response
 * @param {String} allowedMethod - the HTTP method valid for the current request
 */
module.exports.validateRequestMethod = function (req, res, allowedMethod) {
  const method = req.method && req.method.toLowerCase()
  if (method !== allowedMethod.toLowerCase()) {
    Send.html(req, res, null, 405, 'text/html')(
      null,
      errorView({
        headline: 'Method not allowed.',
        human: 'The method used for this request is not supported.',
        developer: 'Did you mean to POST?',
        stack: 'Nothing to see',
        statusCode: 405,
        error: 'Method not allowed',
        server: req.headers.host
      })
    )

    return false
  }

  return true
}

module.exports.clearCache = function (req, Cache, callback) {
  const pathname = req.body.path
  let modelDir = crypto
    .createHash('sha1')
    .update(pathname)
    .digest('hex')
  const cacheDir = config.get('caching.directory.path')

  let datasourceCachePaths = []
  let files = fs.readdirSync(cacheDir)

  if (pathname === '*') {
    modelDir = '.*'

    files = files.filter(file => {
      return file.substr(-5) === '.json'
    })

    files.forEach(file => {
      datasourceCachePaths.push(path.join(cacheDir, file))
    })
  } else {
    const endpointRequest = {
      url: req.headers['host'] + pathname
    }

    const endpoint = Cache.getEndpointMatchingRequest(endpointRequest)

    if (endpoint && endpoint.page && endpoint.page.datasources) {
      endpoint.page.datasources.forEach(datasource => {
        const cachePrefix = crypto
          .createHash('sha1')
          .update(datasource)
          .digest('hex')

        datasourceCachePaths = Object.assign(
          {},
          datasourceCachePaths,
          files.filter(file => {
            return file.includes(cachePrefix)
          })
        )

        datasourceCachePaths = Object.keys(datasourceCachePaths).map(key => {
          return datasourceCachePaths[key]
        })
      })
    }
  }

  // delete using Redis client
  Cache.cache
    .flush(modelDir)
    .then(() => {
      if (datasourceCachePaths.length === 0) {
        return callback(null)
      }

      let idx = 0
      datasourceCachePaths.forEach(dsFile => {
        Cache.cache.flush(dsFile).then(() => {
          if (idx === datasourceCachePaths.length - 1) {
            return callback(null)
          }

          idx++
        })
      })
    })
    .catch(err => {
      console.log(err)
    })
}

/**
 * Decides if we should add compression and what type
 * @param {Object} reqHeaders - Request headers
 */
module.exports.canCompress = function (reqHeaders) {
  let compressType = false

  if (config.get('headers.useCompression') && !config.get('debug')) {
    const acceptEncoding = reqHeaders['accept-encoding'] || ''
    if (~acceptEncoding.indexOf('gzip')) compressType = 'gzip'
    if (~acceptEncoding.indexOf('br')) compressType = 'br'
  }

  return compressType
}

/**
 * Return a copy of the specified object filtered to only have
 * values for the keys in the specified array
 *
 * @param {Object} item - x
 * @param {Array} properties - xx
 * @returns {Object} the object containing only the properties specfied
 */
module.exports.pick = function (item, properties) {
  let obj = {}

  properties.forEach(property => {
    if (property.indexOf('.') > 0) {
      // handle nested fields, e.g. "attributes.title"
      const parts = property.split('.')
      obj[parts[0]] = obj[parts[0]] || {}
      obj[parts[0]][parts[1]] = item[parts[0]][parts[1]]
    } else {
      obj[property] = item[property]
    }
  })

  return obj
}

/**
 * Looks through each value in "data", returning an array of all the
 * items that contain all of the key-value pairs listed in "properties"
 *
 * @param {Array} data - the array to filter
 * @param {Object} properties - the key-value pairs to match against
 * @returns {Array} the filtered array
 */
module.exports.where = function (data, properties) {
  if (properties && Object.keys(properties).length > 0) {
    data = data.filter(item => {
      let match = Object.keys(properties).every(key => {
        return item.hasOwnProperty(key) && item[key] === properties[key]
      })

      if (match) {
        return item
      }
    })
  }

  return data
}

/**
 * http://jsfiddle.net/dFNva/1/
 *
 * @param {string} field - description
 * @param {Function} primer - description
 */
module.exports.sortBy = function (field, primer) {
  let key = function (x) {
    let value = getValue(x, field)
    return primer ? primer(value) : value
  }

  return function (a, b) {
    let A = key(a)
    let B = key(b)

    return A < B ? -1 : A > B ? 1 : 0
  }
}

/**
 * Lists all files in a directory.
 *
 * @param {string} directory Full directory path.
 * @param {object} options
 * @param {array} options.extensions A list of extensions to filter files by.
 * @param {boolean} options.failIfNotFound Whether to throw an error if the directory doesn't exist.
 * @param {boolean} options.recursive Whether to read sub-directories.
 *
 * @return {array} A list of full paths to the discovered files.
 */
function readDirectory (directory, options) {
  options = options || {}

  const extensions = options.extensions
  const failIfNotFound = options.failIfNotFound
  const recursive = options.recursive

  let matchingFiles = []
  let queue = []

  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT' && failIfNotFound) {
          return reject(err)
        }

        return resolve([])
      }

      files.forEach(file => {
        const absolutePath = path.join(directory, file)
        const stats = fs.statSync(absolutePath)

        const isValidExtension =
          !extensions || extensions.includes(path.extname(file))

        if (stats.isFile() && isValidExtension) {
          matchingFiles.push(absolutePath)
        } else if (stats.isDirectory() && recursive) {
          queue.push(
            readDirectory(absolutePath, {
              extensions,
              recursive: true
            }).then(childFiles => {
              matchingFiles = matchingFiles.concat(childFiles)
            })
          )
        }
      })

      Promise.all(queue).then(() => {
        resolve(matchingFiles)
      })
    })
  })
}

module.exports.readDirectory = readDirectory

/**
 * Executes a callback for each file on a list of paths.
 *
 * @param {array} files The file paths.
 * @param {object} options
 * @param {function} options.callback The callback to be executed.
 * @param {array} options.extensions A list of extensions to filter files by.
 *
 * @return {array} A Promise that resolves after all callbacks have executed.
 */
function readFiles (files, options) {
  options = options || {}

  const callback = options.callback
  const extensions = options.extensions

  if (typeof callback !== 'function') {
    return Promise.reject(new Error('Callback missing or invalid'))
  }

  return new Promise((resolve, reject) => {
    let queue = []

    files.forEach(file => {
      const extension = path.extname(file)

      if (extensions && !extensions.includes(extension)) {
        return
      }

      const stats = fs.statSync(file)

      if (!stats.isFile()) return

      queue.push(callback(file))
    })

    resolve(Promise.all(queue))
  })
}

module.exports.readFiles = readFiles

/**
 * Formats bytes to a more human readable size
 *
 * @param {string} the size of the item in bytes
 * @param {string} the decimal places to round the figure by
 *
 * @return {string} the formatted figure e.g, 2 GB
 */

module.exports.formatBytes = function (a, b) {
  if (a === 0) return '0 Bytes'
  let c = 1024
  let d = b || 2
  let e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let f = Math.floor(Math.log(a) / Math.log(c))
  return parseFloat((a / Math.pow(c, f)).toFixed(d)) + ' ' + e[f]
}
