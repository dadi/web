'use strict'

const url = require('url')
const path = require('path')
const request = require('request')
const purest = require('purest')({ request })
const purestConfig = require('@purest/providers')
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const log = require('@dadi/logger')

const help = require(path.join(__dirname, '../help'))

const RestApi = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
RestApi.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema

  // If the provider is an object, pass the config to purest
  // Else, use default @purest/providers
  if (typeof this.datasource.source.provider === 'object') {
    this.provider = Object.keys(this.datasource.source.provider)[0]
    this.config = this.datasource.source.provider
  } else {
    this.provider = this.datasource.source.provider
    this.config = purestConfig
  }

  this.purest = purest({
    provider: this.provider,
    config: this.config,
    defaults: this.datasource.source.auth
  })
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
RestApi.prototype.load = function load (requestUrl, done) {
  log.info(
    { module: 'restapi' },
    'GET datasource "' + this.datasource.schema.datasource.key + '"'
  )

  // allow query string param to bypass cache
  const urlQuery = url.parse(requestUrl, true).query
  const noCache =
    urlQuery.cache && urlQuery.cache.toString().toLowerCase() === 'false'

  try {
    const endpoint = this.schema.datasource.source.endpoint
    const query = this.query

    this.cacheKey = [
      endpoint,
      encodeURIComponent(JSON.stringify(this.schema.datasource))
    ].join('+')

    this.dataCache = new DatasourceCache()

    const cacheOptions = {
      name: this.datasource.name,
      caching: this.schema.datasource.caching,
      cacheKey: this.cacheKey
    }

    this.dataCache.getFromCache(cacheOptions, cachedData => {
      if (cachedData && !noCache) {
        try {
          cachedData = JSON.parse(cachedData.toString())
          return done(null, cachedData)
        } catch (err) {
          console.error(
            'Rest provider: cache data incomplete, making HTTP request: ' +
              err +
              '(' +
              cacheOptions.cacheKey +
              ')'
          )
        }
      }

      this.purest
        .select(endpoint)
        .where(query)
        .request((err, res, body) => {
          log.info(
            { module: 'restapi' },
            'GOT datasource "' +
              this.datasource.schema.datasource.key +
              '": ' +
              decodeURIComponent(res ? res.request.href : '') +
              ' (HTTP ' +
              res.statusCode +
              ', ' +
              help.formatBytes(Buffer.byteLength(body.toString())) +
              ')'
          )

          this.processOutput(res, err, body, noCache, done)
        })
    })
  } catch (ex) {
    done(ex, null)
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
RestApi.prototype.processOutput = function processOutput (
  res,
  error,
  data,
  noCache,
  done
) {
  if (res.statusCode === 200) {
    data = this.processFields(data)

    const cacheOptions = {
      name: this.datasource.name,
      caching: this.schema.datasource.caching,
      cacheKey: this.cacheKey
    }

    // Count variable from datasource
    if (this.count) {
      data = data.slice(0, this.count)
    }

    if (!noCache) {
      this.dataCache.cacheResponse(cacheOptions, JSON.stringify(data), () => {
        //
      })
    }
  }

  if (res.statusCode === 404) {
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
            res.request.href
        }
      ]
    }
  }

  // if the error is anything other than Success or Bad Request, error
  if (res.statusCode === 500) {
    data = {
      results: [],
      errors: [
        {
          code: 'WEB-0004',
          title: 'Datasource Internal Server Error',
          details:
            'Datasource "' +
            this.datasource.name +
            '" failed. ' +
            res.statusMessage +
            ' (' +
            res.statusCode +
            ')' +
            ': ' +
            res.request.href
        }
      ]
    }
  }

  if (Buffer.isBuffer(data)) {
    data = data.toString()
  }

  if (typeof data === 'string') {
    data = JSON.parse(data)
  }

  return done(null, data)
}

/**
 * processFields - remove any unwanted fields from the dataset
 *
 * @param  {obj} data before it's been processed
 * @return {obj} data after it's been processed
 */
RestApi.prototype.processFields = function processFields (data) {
  const fields = this.schema.datasource.fields
  const keys = fields && Object.keys(fields)

  if (keys && keys.length) {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        data[i] = help.pick(data[i], keys)
      }
    } else {
      data = help.pick(data, keys)
    }
  }

  return data
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} datasourceParams
 * @return {void}
 */
RestApi.prototype.processRequest = function processRequest (datasourceParams) {
  this.query = datasourceParams.query
  this.count = datasourceParams.count
}

module.exports = RestApi
