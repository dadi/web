'use strict'

const _ = require('underscore')
const debug = require('debug')('web:provider:remote')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')

const log = require('@dadi/logger')
const BearerAuthStrategy = require(path.join(__dirname, '/../auth/bearer'))
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const RemoteProvider = function () {}

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
  this.redirects = 0
}

/**
 * buildEndpoint - constructs the datasource endpoint using properties defined in the schema
 *
 * @return {void}
 */
RemoteProvider.prototype.buildEndpoint = function buildEndpoint () {
  const source = this.schema.datasource.source

  const protocol = source.protocol || 'http'
  const port = source.port || 80

  const uri = [
    protocol,
    '://',
    source.host,
    port !== '' ? ':' + port : '',
    '/',
    this.datasource.source.modifiedEndpoint || source.endpoint
  ].join('')

  this.endpoint = this.processDatasourceParameters(this.schema, uri)
}

/**
 * getHeaders
 *
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.getHeaders = function getHeaders (done) {
  const headers = {
    'accept-encoding': 'gzip'
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
    return done(null, { headers: headers })
  }
}

/**
 * handleResponse
 *
 * @param  {response} res - response
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.handleResponse = function handleResponse (res, done) {
  const encoding = res.headers['content-encoding']
    ? res.headers['content-encoding']
    : ''
  let output = ''

  if (encoding === 'gzip') {
    const gunzip = zlib.createGunzip()
    const buffer = []

    gunzip
      .on('data', data => {
        buffer.push(data.toString())
      })
      .on('end', () => {
        output = buffer.join('')
        this.processOutput(res, output, (err, data, res) => {
          if (err) return done(err)
          return done(null, data, res)
        })
      })
      .on('error', err => {
        done(err)
      })

    res.pipe(gunzip)
  } else {
    res.on('data', chunk => {
      output += chunk
    })

    res.on('end', () => {
      this.processOutput(res, output, (err, data, res) => {
        if (err) return done(err)
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
RemoteProvider.prototype.keepAliveAgent = function keepAliveAgent (protocol) {
  return protocol.indexOf('https') > -1
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true })
}

/**
 * load - loads data from the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
RemoteProvider.prototype.load = function (requestUrl, done) {
  this.requestUrl = requestUrl
  this.dataCache = DatasourceCache()

  this.options = {
    protocol: this.datasource.source.protocol,
    host: this.datasource.source.host,
    port: this.datasource.source.port || 80,
    path: url.parse(this.endpoint).path,
    method: 'GET'
  }

  this.options.protocol = this.options.protocol + ':'

  this.dataCache.getFromCache(this.datasource, cachedData => {
    if (cachedData) return done(null, cachedData)

    debug('load %s', this.endpoint)

    this.getHeaders((err, headers) => {
      if (err) return done(err)

      this.options = _.extend(this.options, headers)

      this.makeRequest(done)
    })
  })
}

RemoteProvider.prototype.makeRequest = function (done) {
  debug(
    'GET datasource "%s" %o',
    this.datasource.schema.datasource.key,
    _.omit(this.options, 'agent')
  )

  this.options.agent = this.keepAliveAgent(this.options.protocol)

  const agent = this.options.protocol.indexOf('https') > -1 ? https : http

  let request = agent.request(this.options, res => {
    if (
      res.statusCode === 301 ||
      res.statusCode === 302 ||
      res.statusCode === 307
    ) {
      this.redirects++

      if (this.redirects >= 10) {
        var err = new Error('Infinite redirect loop detected')
        err.remoteIp = this.options.host
        err.remotePort = this.options.port
        return done(err)
      }

      var options = url.parse(res.headers.location)
      this.options = _.extend(this.options, options)

      debug('following %s redirect to %s', res.statusCode, res.headers.location)
      this.makeRequest(done)
    } else {
      this.handleResponse(res, done)
    }
  })

  request.on('error', err => {
    const message =
      err.toString() +
      ". Couldn't request data from " +
      this.datasource.endpoint
    err.name = 'GetData'
    err.message = message
    err.remoteIp = this.options.host
    err.remotePort = this.options.port
    return done(err)
  })

  request.end()
}

/**
 * processDatasourceParameters - adds querystring parameters to the datasource endpoint using properties defined in the schema
 *
 * @param  {Object} schema - the datasource schema
 * @param  {type} uri - the original datasource endpoint
 * @returns {string} the original uri
 */
RemoteProvider.prototype.processDatasourceParameters = function processDatasourceParameters (
  schema,
  uri
) {
  return uri
}

/**
 * processOutput
 *
 * @param  {response} res
 * @param  {string} data
 * @param  {fn} done
 * @return {void}
 */
RemoteProvider.prototype.processOutput = function processOutput (
  res,
  data,
  done
) {
  // Return a 202 Accepted response immediately,
  // along with the datasource response
  if (res.statusCode === 202) {
    return done(null, JSON.parse(data), res)
  }

  // return 5xx error as the datasource response
  if (res.statusCode && /^5/.exec(res.statusCode)) {
    data = {
      results: [],
      errors: [
        {
          code: 'WEB-0005',
          title: 'Datasource Timeout',
          details: "The datasource '" +
            this.datasource.name +
            "' timed out: " +
            res.statusMessage +
            ' (' +
            res.statusCode +
            ')' +
            ': ' +
            this.endpoint
        }
      ]
    }
  } else if (res.statusCode === 404) {
    data = {
      results: [],
      errors: [
        {
          code: 'WEB-0004',
          title: 'Datasource Not Found',
          details: 'Datasource "' +
            this.datasource.name +
            '" failed. ' +
            res.statusMessage +
            ' (' +
            res.statusCode +
            ')' +
            ': ' +
            this.endpoint
        }
      ]
    }
  } else if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    // if the error is anything other than Success or Bad Request, error
    const err = new Error()
    err.message =
      'Datasource "' +
      this.datasource.name +
      '" failed. ' +
      res.statusMessage +
      ' (' +
      res.statusCode +
      ')' +
      ': ' +
      this.endpoint
    if (data) err.message += '\n' + data

    err.remoteIp = this.options.host
    err.remotePort = this.options.port

    log.error(
      { module: 'helper' },
      res.statusMessage + ' (' + res.statusCode + ')' + ': ' + this.endpoint
    )

    // return done(err)
    throw err
  }

  // Cache 200 responses
  if (res.statusCode === 200) {
    this.dataCache.cacheResponse(this.datasource, data, () => {
      //
    })
  }

  return done(null, data)
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
RemoteProvider.prototype.processRequest = function processRequest (req) {
  this.buildEndpoint()
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
