'use strict'

const _ = require('underscore')
const url = require('url')
const http = require('http')
const https = require('https')
const zlib = require('zlib')

const config = require(__dirname + '/../../../config.js')
const log = require('@dadi/logger')
const help = require(__dirname + '/../help')
const BearerAuthStrategy = require(__dirname + '/../auth/bearer')
const DatasourceCache = require(__dirname + '/../cache/datasource')

const RemoteProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
RemoteProvider.prototype.initialise = function initialise(datasource, schema) {
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
RemoteProvider.prototype.buildEndpoint = function buildEndpoint() {
  const apiConfig = config.get('api')
  const source = this.schema.datasource.source

  const protocol = source.protocol || 'http'
  const host = source.host || apiConfig.host
  const port = source.port || apiConfig.port

  const uri = [protocol, '://', host, (port !== '' ? ':' : ''),
               port, '/', source.endpoint].join('')

  this.endpoint = this.processDatasourceParameters(this.schema, uri)
}

/**
 * getHeaders
 *
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.getHeaders = function getHeaders(done) {
  const headers = {
    'accept-encoding': 'gzip'
  }

  // If the data-source has its own auth strategy, use it.
  // Otherwise, authenticate with the main server via bearer token
  if (this.datasource.authStrategy) {
    // This could eventually become a switch statement that handles different auth types
    if (this.datasource.authStrategy.getType() === 'bearer') {
      this.datasource.authStrategy.getToken(this.datasource, (err, bearerToken) => {
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
    }
    catch (err) {
      console.log(err.stack)
    }
  }
}

/**
 * handleResponse
 *
 * @param  {response} res - response
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.handleResponse = function handleResponse(res, done) {
  const self = this
  const encoding = res.headers['content-encoding'] ? res.headers['content-encoding'] : ''
  let output = ''

  if (encoding === 'gzip') {
    const gunzip = zlib.createGunzip()
    const buffer = []

    gunzip.on('data', (data) => {
      buffer.push(data.toString())
    }).on('end', () => {
      output = buffer.join('')
      self.processOutput(res, output, (err, data, res) => {
        return done(null, data, res)
      })
    }).on('error', (err) => {
      done(err)
    })

    res.pipe(gunzip)
  } else {
    res.on('data', (chunk) => {
      output += chunk
    })

    res.on('end', () => {
      self.processOutput(res, output, (err, data, res) => {
        return done(null, data, res)
      })
    })
  }
}

/**
 * keepAliveAgent - returns http|https module depending on config
 *
 * @param  {string} protocol
 * @return {module} http|https
 */
RemoteProvider.prototype.keepAliveAgent = function keepAliveAgent(protocol) {
  return (protocol === 'https')
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true })
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
RemoteProvider.prototype.load = function (requestUrl, done) {
  const self = this

  this.requestUrl = requestUrl
  this.dataCache = new DatasourceCache(this.datasource, requestUrl)

  this.options = {
    protocol: this.datasource.source.protocol || config.get('api.protocol'),
    host: this.datasource.source.host || config.get('api.host'),
    port: this.datasource.source.port || config.get('api.port'),
    path: url.parse(this.endpoint).path,
    method: 'GET'
  }

  this.options.agent = this.keepAliveAgent(this.options.protocol)
  this.options.protocol = this.options.protocol + ':'

  this.dataCache.getFromCache((cachedData) => {
    if (cachedData) return done(null, cachedData)

    self.getHeaders((err, headers) => {
      err && done(err)

      self.options = _.extend(self.options, headers)

      log.info({module: 'helper'}, "GET datasource '" + self.datasource.schema.datasource.key + "': " + self.options.path)

      const agent = (self.options.protocol === 'https') ? https : http
      let request = agent.request(self.options, (res) => {
        self.handleResponse(res, done)
      })

      request.on('error', (err) => {
        const message = err.toString() + '. Couldn\'t request data from ' + self.datasource.endpoint
        err.name = 'GetData'
        err.message = message
        err.remoteIp = self.options.host
        err.remotePort = self.options.port
        return done(err)
      })

      request.end()
    })
  })
}

/**
 * processDatasourceParameters - adds querystring parameters to the datasource endpoint using properties defined in the schema
 *
 * @param  {json} schema - the datasource schema
 * @param  {type} uri - the original datasource endpoint
 * @return {string} uri with query string appended
 */
RemoteProvider.prototype.processDatasourceParameters = function processDatasourceParameters(schema, uri) {
  let query = '?'

  const params = [
    { "count": (schema.datasource.count || 0) },
    { "skip": (schema.datasource.skip) },
    { "page": (schema.datasource.page || 1) },
    { "referer": schema.datasource.referer },
    { "filter": schema.datasource.filter || {} },
    { "fields": schema.datasource.fields || {} },
    { "sort": this.processSortParameter(schema.datasource.sort) }
  ]

  // pass cache flag to API endpoint
  if (schema.datasource.hasOwnProperty('cache')) {
    params.push({ "cache": schema.datasource.cache })
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
 * processOutput
 *
 * @param  {response} res
 * @param  {string} data
 * @param  {fn} done
 * @return {void}
 */
RemoteProvider.prototype.processOutput = function processOutput(res, data, done) {
  const self = this

  // Return a 202 Accepted response immediately,
  // along with the datasource response
  if (res.statusCode === 202) {
    return done(null, JSON.parse(data), res)
  }

  // if the error is anything other than
  // Success or Bad Request, error
  if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    const err = new Error()
    err.message = 'Datasource "' + this.datasource.name + '" failed. ' + res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint
    if (data) err.message += '\n' + data

    err.remoteIp = self.options.host
    err.remotePort = self.options.port

    log.error({module: 'helper'}, res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint)
    //return done(err)
    throw(err)
  }

  // Cache 200 responses
  if (res.statusCode === 200) {
    this.dataCache.cacheResponse(data, () => {})
  }

  return done(null, data)
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
RemoteProvider.prototype.processRequest = function processRequest(req) {
  this.buildEndpoint()
}

/**
 * processSortParameter
 *
 * @param  {?} obj - sort parameter
 * @return {?}
 */
RemoteProvider.prototype.processSortParameter = function processSortParameter(obj) {
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
RemoteProvider.prototype.setAuthStrategy = function setAuthStrategy() {
  if (!this.schema.datasource.auth) return null
  this.authStrategy = new BearerAuthStrategy(this.schema.datasource.auth)
}

module.exports = RemoteProvider
