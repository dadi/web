'use strict'

const debug = require('debug')('web:provider:remote')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')

const log = require('@dadi/logger')
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const help = require(path.join(__dirname, '../help'))

const RemoteProvider = function () {
  this.dataCache = new DatasourceCache()
}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
RemoteProvider.prototype.initialise = function (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.buildEndpoint()
  this.redirects = 0
}

/**
 * buildEndpoint - constructs the datasource endpoint using properties defined in the schema
 *
 * @return {void}
 */
RemoteProvider.prototype.buildEndpoint = function (datasourceParams) {
  if (!datasourceParams) {
    datasourceParams = this.schema.datasource
  }

  const source = datasourceParams.source || this.datasource.source

  const protocol = source.protocol || 'http'
  const host = source.host
  const port = source.port

  const uri = [
    protocol,
    '://',
    host,
    port !== '' ? ':' : '',
    port,
    '/',
    this.datasource.source.modifiedEndpoint || source.endpoint
  ].join('')

  // return this.processDatasourceParameters(datasourceParams, uri)
  this.endpoint = this.processDatasourceParameters(datasourceParams, uri)
}

/**
 * Load data from the specified datasource
 *
 * @param  {string} requestUrl - datasource endpoint to load
 * @param  {fn} done - callback on error or completion
 */
RemoteProvider.prototype.load = function (requestUrl, done) {
  this.options = {
    protocol: this.datasource.source.protocol || 'http',
    host: this.datasource.source.host,
    port: this.datasource.source.port || '80',
    path: url.parse(this.endpoint).path,
    // path: url.parse(requestUrl).path,
    method: 'GET'
  }

  //   this.requestUrl = requestUrl
  // this.dataCache = DatasourceCache()

  this.options.protocol = this.options.protocol + ':'

  const cacheOptions = {
    name: this.datasource.name,
    caching: this.schema.datasource.caching,
    // endpoint: requestUrl
    endpoint: this.endpoint
  }

  this.dataCache.getFromCache(cacheOptions, cachedData => {
    // data found in the cache, parse into JSON
    // and return to whatever called load()
    if (cachedData) {
      try {
        cachedData = JSON.parse(cachedData.toString())
        return done(null, cachedData)
      } catch (err) {
        log.error(
          'Remote: cache data incomplete, making HTTP request: ' +
            err +
            '(' +
            cacheOptions.endpoint +
            ')'
        )
      }
    }

    debug('load %s', this.endpoint)

    this.getHeaders((err, headers) => {
      if (err) return done(err)

      this.options = Object.assign({}, this.options, headers)

      this.makeRequest(requestUrl, done)
    })
  })
}

RemoteProvider.prototype.makeRequest = function (requestUrl, done) {
  debug(
    'GET datasource "%s" %o',
    this.datasource.schema.datasource.key,
    this.options
  )

  this.options.agent = this.keepAliveAgent(this.options.protocol)

  const agent = this.options.protocol.includes('https') ? https : http

  let request = agent.request(this.options, res => {
    if (
      res.statusCode === 301 ||
      res.statusCode === 302 ||
      res.statusCode === 307
    ) {
      this.redirects++

      if (this.redirects >= 10) {
        const err = new Error('Infinite redirect loop detected')
        err.remoteIp = this.options.host
        err.remotePort = this.options.port
        return done(err)
      }

      const options = url.parse(res.headers.location)
      this.options = Object.assign({}, this.options, options)

      debug('following %s redirect to %s', res.statusCode, res.headers.location)
      this.makeRequest(requestUrl, done)
    } else {
      this.handleResponse(requestUrl, res, done)
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
 * handleResponse
 *
 * @param  {response} res - response
 * @param  {fn} done - callback
 * @return {void}
 */
RemoteProvider.prototype.handleResponse = function (requestUrl, res, done) {
  const encoding = res.headers['content-encoding']
    ? res.headers['content-encoding']
    : ''

  const buffers = []
  let output

  if (encoding === 'gzip') {
    const gunzip = zlib.createGunzip()

    gunzip
      .on('data', data => {
        buffers.push(data)
      })
      .on('end', () => {
        output = Buffer.concat(buffers)

        this.processOutput(requestUrl, res, output, (err, data, res) => {
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
}

/**
 * processOutput
 *
 * @param  {response} res
 * @param  {string} data
 * @param  {fn} done
 * @return {void}
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
        results: [],
        errors: [
          {
            code: 'WEB-0005',
            title: 'Datasource Timeout',
            details:
              "The datasource '" +
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
            details:
              'Datasource "' +
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
      log.info(
        { module: 'remote' },
        'GOT datasource "' +
          this.datasource.schema.datasource.key +
          '": ' +
          decodeURIComponent(this.endpoint) +
          ' (HTTP 200, ' +
          help.formatBytes(Buffer.byteLength(data)) +
          ')'
      )

      const cacheOptions = {
        name: this.datasource.name,
        caching: this.schema.datasource.caching,
        endpoint: this.endpoint
      }

      this.dataCache.cacheResponse(cacheOptions, data, written => {
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
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
RemoteProvider.prototype.processRequest = function (datasourceParams) {
  this.buildEndpoint(datasourceParams)
}

/**
 * processDatasourceParameters - adds querystring parameters to the datasource endpoint using properties defined in the schema
 *
 * @param  {Object} schema - the datasource schema
 * @param  {type} uri - the original datasource endpoint
 * @returns {string} the original uri
 */
RemoteProvider.prototype.processDatasourceParameters = function (schema, uri) {
  return uri
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

  return done(null, { headers })
}

/**
 * keepAliveAgent - returns http|https module depending on config
 *
 * @param  {string} protocol
 * @return {module} http|https
 */
RemoteProvider.prototype.keepAliveAgent = function keepAliveAgent (protocol) {
  return protocol.includes('https')
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true })
}

module.exports = RemoteProvider
