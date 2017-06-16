'use strict'

const _ = require('underscore')
const debug = require('debug')('web:provider:remote')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')

const config = require(path.join(__dirname, '/../../../config.js'))
const log = require('@dadi/logger')
const help = require(path.join(__dirname, '/../help'))
const BearerAuthStrategy = require(path.join(__dirname, '/../auth/bearer'))
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const RemoteProvider = function () {
  this.dataCache = new DatasourceCache()

  RemoteProvider.numInstances = (RemoteProvider.numInstances || 0) + 1
  // console.log('RemoteProvider:', RemoteProvider.numInstances)
}

RemoteProvider.prototype.destroy = function() {
  RemoteProvider.numInstances = (RemoteProvider.numInstances || 0) - 1
}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
RemoteProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
  this.buildEndpoint()
}

/**
 * buildEndpoint - constructs the datasource endpoint using properties defined in the schema
 *
 * @return {void}
 */
RemoteProvider.prototype.buildEndpoint = function buildEndpoint (datasourceParams) {
  if (!datasourceParams) {
    datasourceParams = this.schema.datasource
  }

  const apiConfig = config.get('api')
  const source = datasourceParams.source

  const protocol = source.protocol || 'http'
  const host = source.host || apiConfig.host
  const port = source.port || apiConfig.port

  const uri = [protocol, '://', host, (port !== '' ? ':' : ''),
    port, '/', this.datasource.source.modifiedEndpoint || source.endpoint].join('')

  return this.processDatasourceParameters(datasourceParams, uri)
}

/**
 * Load data from the specified datasource
 *
 * @param  {string} requestUrl - datasource endpoint to load
 * @param  {fn} done - callback on error or completion
 */
RemoteProvider.prototype.load = function (requestUrl, done) {
  this.options = {
    protocol: this.datasource.source.protocol || config.get('api.protocol'),
    host: this.datasource.source.host || config.get('api.host'),
    port: this.datasource.source.port || config.get('api.port'),
    // path: url.parse(this.endpoint).path,
    path: url.parse(requestUrl).path,
    method: 'GET'
  }

  this.options.agent = this.keepAliveAgent(this.options.protocol)
  this.options.protocol = this.options.protocol + ':'

  var cacheOptions = {
    name: this.datasource.name,
    caching: this.schema.datasource.caching,
    endpoint: requestUrl // this.endpoint
  }

  this.dataCache.getFromCache(cacheOptions, (cachedData) => {
    // data found in the cache, parse into JSON
    // and return to whatever called load()
    if (cachedData) {
      try {
        cachedData = JSON.parse(cachedData.toString())
        return done(null, cachedData)
      } catch (err) {
        log.error('Remote: cache data incomplete, making HTTP request: ' + err + '(' + cacheOptions.endpoint + ')')
      }
    }

    debug('load %s', requestUrl)

    this.getHeaders((err, headers) => {
      err && done(err)

      this.options = _.extend(this.options, headers)

      log.info({module: 'remote'}, 'GET datasource "' + this.datasource.schema.datasource.key + '": ' + decodeURIComponent(requestUrl))

      const agent = (this.options.protocol === 'https') ? https : http

      let request = agent.request(this.options)

      request.on('response', (res) => {
        this.handleResponse(requestUrl, res, done)
      })

      request.on('error', (err) => {
        const message = err.toString() + ". Couldn't request data from " + requestUrl

        err.name = 'GetData'
        err.message = message
        err.remoteIp = this.options.host
        err.remotePort = this.options.port
        return done(err)
      })

      request.end()
    })
  })
}

/**
 * Takes the response from the server and turns it into a Buffer,
 * decompressing it if required. Calls processOutput() with the Buffer.
 *
 * @param {http.ServerResponse} res - the full HTTP response
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.handleResponse = function (requestUrl, res, done) {
  setImmediate(() => {
    var encoding = res.headers['content-encoding'] ? res.headers['content-encoding'] : ''
    var buffers = []
    var output

    if (encoding === 'gzip') {
      const gunzip = zlib.createGunzip()

      gunzip.on('data', (data) => {
        buffers.push(data)
      }).on('end', () => {
        output = Buffer.concat(buffers)

        this.processOutput(requestUrl, res, output, (err, data, res) => {
          if (err) return done(err)
          return done(null, data, res)
        })
      }).on('error', (err) => {
        done(err)
      })

      res.pipe(gunzip)
    } else {
      res.on('data', (chunk) => {
        buffers.push(chunk)
      })

      res.on('end', () => {
        output = Buffer.concat(buffers)

        this.processOutput(requestUrl, res, output, (err, data, res) => {
          if (err) return done(err)
          return done(null, data, res)
        })
      })
    }
  })
}

/**
 * Processes the response from the server, caching it if it's a 200
 *
 * @param {http.ServerResponse} res - the full HTTP response
 * @param {Buffer} data - the body of the response as a Buffer
 * @param {fn} done - the method to call when finished, accepts args (err, data, res)
 */
RemoteProvider.prototype.processOutput = function (requestUrl, res, data, done) {
  setImmediate(() => {
    // Return a 202 Accepted response immediately,
    // along with the datasource response
    if (res.statusCode === 202) {
      return done(null, JSON.parse(data.toString()), res)
    }

    // return 5xx error as the datasource response
    if (res.statusCode && /^5/.exec(res.statusCode)) {
      data = {
        'results': [],
        'errors': [{
          'code': 'WEB-0005',
          'title': 'Datasource Timeout',
          'details': "The datasource '" + this.datasource.name + "' timed out: " + res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint
        }]
      }
    } else if (res.statusCode === 404) {
      data = {
        'results': [],
        'errors': [{
          'code': 'WEB-0004',
          'title': 'Datasource Not Found',
          'details': 'Datasource "' + this.datasource.name + '" failed. ' + res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint
        }]
      }
    } else if (res.statusCode && !/200|400/.exec(res.statusCode)) {
      // if the error is anything other than Success or Bad Request, error
      const err = new Error()
      err.message = 'Datasource "' + this.datasource.name + '" failed. ' + res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint
      if (data) err.message += '\n' + data.toString()

      err.remoteIp = this.options.host
      err.remotePort = this.options.port

      log.error({module: 'remote'}, res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint)

      console.log(err)
      // return done(err)
      throw (err)
    }

    // Cache 200 responses
    if (res.statusCode === 200) {
      log.info(
        {module: 'remote'},
        'GOT datasource "' +
        this.datasource.schema.datasource.key +
        '": ' + decodeURIComponent(requestUrl) +
        ' (HTTP 200, ' +
        require('humanize-plus').fileSize(Buffer.byteLength(data)) + ')'
      )

      // log.info(
      //   {module: 'remote'}, '> CALL cacheResponse ' +  requestUrl + ' ' + this.dataCache.stillCaching)

      var cacheOptions = {
        name: this.datasource.name,
        caching: this.schema.datasource.caching,
        endpoint: requestUrl // this.endpoint
      }

      this.dataCache.cacheResponse(cacheOptions, data, written => {
        // console.log(typeof data, Buffer.isBuffer(data))
        // console.log(written, this.dataCache.stillCaching)
        return done(null, JSON.parse(data.toString()))
      })
    } else {
      if (Buffer.isBuffer(data)) {
        data = data.toString()
      }

      if (typeof data === 'string') {
        data = JSON.parse(data)
      }

      return done(null, data)
    }
  })
}

/**
 * Called on every request, rebuilds the datasource endpoint
 *
 * @param  {http.IncomingMessage} req - the full HTTP request object
 */
RemoteProvider.prototype.processRequest = function (datasourceParams) {
  return this.buildEndpoint(datasourceParams)
}

/**
 * Adds querystring parameters to the datasource endpoint using
 * properties defined in the schema
 *
 * @param  {Object} schema - the datasource schema
 * @param  {type} uri - the original datasource endpoint
 * @returns {string} uri with query string appended
 */
RemoteProvider.prototype.processDatasourceParameters = function (datasourceParams, uri) {
  debug('processDatasourceParameters %s', uri)

  let query = (uri.indexOf('?') > 0) ? '&' : '?'

  const params = [
    { 'count': (datasourceParams.count || 0) },
    { 'skip': (datasourceParams.skip) },
    { 'page': (datasourceParams.page || 1) },
    { 'filter': datasourceParams.filter || {} },
    { 'fields': datasourceParams.fields || {} },
    { 'sort': this.processSortParameter(datasourceParams.sort) }
  ]

  // pass cache flag to API endpoint
  if (datasourceParams.hasOwnProperty('cache')) {
    params.push({ 'cache': datasourceParams.cache })
  }

  params.forEach((param) => {
    for (let key in param) {
      if (param.hasOwnProperty(key) && (typeof param[key] !== 'undefined')) {
        query = query + key + '=' + (_.isObject(param[key]) ? JSON.stringify(param[key]) : param[key]) + '&'
      }
    }
  })

  return uri + query.slice(0, -1)
}

/**
 * Requests an Authorization token and sets up the request headers
 * with encoding and Authorization values
 *
 * @param  {fn} done - returns the request headers
 */
RemoteProvider.prototype.getHeaders = function (done) {
  var headers = {
    'accept-encoding': 'gzip'
  }

  if (this.datasource.requestHeaders) {
    delete this.datasource.requestHeaders['host']
    delete this.datasource.requestHeaders['content-length']
    delete this.datasource.requestHeaders['accept']

    if (this.datasource.requestHeaders['content-type'] !== 'application/json') {
      this.datasource.requestHeaders['content-type'] = 'application/json'
    }

    headers = _.extend(headers, this.datasource.requestHeaders)
  }

  // If the data-source has its own auth strategy, use it.
  // Otherwise, authenticate with the main server via bearer token
  if (this.authStrategy) {
    // This could eventually become a switch statement that handles different auth types
    if (this.authStrategy.getType() === 'bearer') {
      this.authStrategy.getToken(this.authStrategy, (err, bearerToken) => {
        if (err) {
          return done(err)
        }

        headers['Authorization'] = 'Bearer ' + bearerToken

        return done(null, { headers: headers })
      })
    }
  } else {
    try {
      help.getToken(this.datasource).then((bearerToken) => {
        headers['Authorization'] = 'Bearer ' + bearerToken

        help.timer.stop('auth')
        return done(null, { headers: headers })
      }).catch((errorData) => {
        const err = new Error()
        err.name = errorData.title
        err.message = errorData.detail
        err.remoteIp = config.get('api.host')
        err.remotePort = config.get('api.port')
        err.path = config.get('auth.tokenUrl')

        if (errorData.stack) {
          console.log(errorData.stack)
        }

        help.timer.stop('auth')
        return done(err)
      })
    } catch (err) {
      console.log(err.stack)
    }
  }
}

/**
 * Returns http|https keepAliveAgent depending on specified protocol
 *
 * @param  {string} protocol - the protocol for the current request
 * @returns {module} http|https keepAliveAgent
 */
RemoteProvider.prototype.keepAliveAgent = function (protocol) {
  return (protocol === 'https')
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true })
}

/**
 * processSortParameter
 *
 * @param  {?} obj - sort parameter
 * @return {?}
 */
RemoteProvider.prototype.processSortParameter = function processSortParameter (obj) {
  let sort = {}

  if (typeof obj !== 'object' || obj === null) return sort

  if (_.isArray(obj)) {
    _.each(obj, (value, key) => {
      if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
        sort[value.field] = (value.order === 'asc') ? 1 : -1
      }
    })
  } else if (obj.hasOwnProperty('field') && obj.hasOwnProperty('order')) {
    sort[obj.field] = (obj.order === 'asc') ? 1 : -1
  } else {
    sort = obj
  }

  return sort
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
RemoteProvider.prototype.setAuthStrategy = function setAuthStrategy () {
  if (!this.schema.datasource.auth) return null
  this.authStrategy = new BearerAuthStrategy(this.schema.datasource.auth)
}

module.exports = RemoteProvider
