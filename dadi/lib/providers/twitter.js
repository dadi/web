'use strict'

const path = require('path')
const request = require('request')
const promise = Promise
const purest = require('purest')({ request, promise })
const purestConfig = require('@purest/providers')
const config = require(path.join(__dirname, '/../../../config.js'))
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const help = require(path.join(__dirname, '../help'))

const TwitterProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
TwitterProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
  this.twitterApi = purest({
    provider: 'twitter',
    config: purestConfig,
    key: this.consumerKey,
    secret: this.consumerSecret
  })
}

/**
 * buildQueryParams
 *
 * @return {obj} query params to pass to the twitter api
 */
TwitterProvider.prototype.buildQueryParams = function buildQueryParams () {
  const params = {}
  const datasource = this.schema.datasource

  params.count = datasource.count

  for (let f in datasource.filter) {
    params[f] = datasource.filter[f]
  }

  return params
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
TwitterProvider.prototype.load = function load (requestUrl, done) {
  try {
    const endpoint = this.schema.datasource.source.endpoint
    const queryParams = this.buildQueryParams()
    this.cacheKey = [
      endpoint,
      encodeURIComponent(JSON.stringify(this.schema.datasource))
    ].join('+')

    this.dataCache = new DatasourceCache()

    var cacheOptions = {
      name: this.datasource.name,
      caching: this.schema.datasource.caching,
      cacheKey: this.cacheKey
    }

    this.dataCache.getFromCache(cacheOptions, cachedData => {
      if (cachedData) {
        try {
          cachedData = JSON.parse(cachedData.toString())
          return done(null, cachedData)
        } catch (err) {
          console.error(
            'Twitter: cache data incomplete, making HTTP request: ' +
              err +
              '(' +
              cacheOptions.cacheKey +
              ')'
          )
        }
      }

      this.twitterApi
        .select(endpoint)
        .where(queryParams)
        .auth(this.accessTokenKey, this.accessTokenSecret)
        .request()
        .catch(err => done(err, null))
        .then(result => this.processOutput(result[0], result[1], done))
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
TwitterProvider.prototype.processOutput = function processOutput (
  res,
  data,
  done
) {
  // if the error is anything other than Success or Bad Request, error
  if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    const err = new Error()
    const info = `${res.statusMessage} (${res.statusCode}): ${this.endpoint}`

    err.remoteIp = this.options.host
    err.remotePort = this.options.port
    err.message = `Datasource "${this.datasource.name}" failed. ${info}`
    if (data) err.message += '\n' + data

    return done(err)
  }

  if (res.statusCode === 200) {
    data = this.processFields(data)

    var cacheOptions = {
      name: this.datasource.name,
      caching: this.schema.datasource.caching,
      cacheKey: this.cacheKey
    }

    this.dataCache.cacheResponse(cacheOptions, JSON.stringify(data), () => {
      //
    })
  }

  return done(null, data)
}

/**
 * processFields - remove any unwanted fields from the dataset
 *
 * @param  {obj} data before it's been processed
 * @return {obj} data after it's been processed
 */
TwitterProvider.prototype.processFields = function processFields (data) {
  const fields = this.schema.datasource.fields

  // console.log('**fields'.red, fields)

  if (fields && Object.keys(fields).length) {
    const keys = Object.keys(fields)
    // console.log('**keys'.red, keys)

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
 * @param  {obj} req - web request object
 * @return {void}
 */
TwitterProvider.prototype.processRequest = function processRequest (req) {
  // not used
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
TwitterProvider.prototype.setAuthStrategy = function setAuthStrategy () {
  const auth = this.schema.datasource.auth

  this.consumerKey =
    (auth && auth.consumer_key) || config.get('twitter.consumerKey')
  this.consumerSecret =
    (auth && auth.consumer_secret) || config.get('twitter.consumerSecret')
  this.accessTokenKey =
    (auth && auth.access_token_key) || config.get('twitter.accessTokenKey')
  this.accessTokenSecret =
    (auth && auth.access_token_secret) ||
    config.get('twitter.accessTokenSecret')
}

module.exports = TwitterProvider
