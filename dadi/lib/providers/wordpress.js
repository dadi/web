'use strict'

const _ = require('underscore')
const path = require('path')
const Purest = require('purest')
const log = require('@dadi/logger')
const config = require(path.join(__dirname, '/../../../config.js'))
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const WordPressProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
WordPressProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
  this.wordpressApi = new Purest({
    provider: 'wordpress',
    version: 'v1.1'
  })
}

/**
 * buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
WordPressProvider.prototype.buildEndpoint = function buildEndpoint (req) {
  const endpointParams = this.schema.datasource.endpointParams || []
  const endpoint = this.schema.datasource.source.endpoint

  this.endpoint = endpoint

  // make sure that we interpolate any dynamic parts to the endpoint
  if (endpointParams.length > 0) {
    endpointParams.forEach((element, index, array) => {
      if (element.param && req.params[element.param]) {
        this.endpoint = this.endpoint.replace(`$${element.field}`, req.params[element.param])
      }
    })
  }
}

/**
 * buildQueryParams
 *
 * @return {obj} query params to pass to the wordpress api
 */
WordPressProvider.prototype.buildQueryParams = function buildQueryParams () {
  const params = {}
  const datasource = this.schema.datasource

  params.count = datasource.count
  params.fields = ''

  if (_.isArray(datasource.fields)) {
    params.fields = datasource.fields.join(',')
  } else if (_.isObject(datasource.fields)) {
    params.fields = Object.keys(datasource.fields).join(',')
  }

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
WordPressProvider.prototype.load = function load (requestUrl, done) {
  try {
    const queryParams = this.buildQueryParams()

    this.cacheKey = [this.endpoint, encodeURIComponent(JSON.stringify(this.schema.datasource))].join('+')
    this.dataCache = new DatasourceCache(this.datasource)

    this.dataCache.getFromCache((cachedData) => {
      if (cachedData) return done(null, cachedData)

      this.wordpressApi.query()
        .select(this.endpoint)
        .where(queryParams)
        .auth(this.bearerToken || null)
        .request((err, res, body) => {
          if (err) return done(err, null)
          this.processOutput(res, body, done)
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
WordPressProvider.prototype.processOutput = function processOutput (res, data, done) {
  // if the error is anything other than Success or Bad Request, error
  if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    const err = new Error()
    const info = `${res.statusMessage} (${res.statusCode}): ${this.endpoint}`

    err.message = `Datasource "${this.datasource.name}" failed. ${info}`
    if (data) err.message += '\n' + data

    log.error({ module: 'helper' }, info)
    return done(err)
  }

  if (res.statusCode === 200) {
    this.dataCache.cacheResponse(JSON.stringify(data), () => {
    })
  }

  return done(null, data)
}

/**
 * processRequest - called on every request, call buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
WordPressProvider.prototype.processRequest = function processRequest (req) {
  this.buildEndpoint(req)
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
WordPressProvider.prototype.setAuthStrategy = function setAuthStrategy () {
  const auth = this.schema.datasource.auth

  this.bearerToken = auth && auth.bearerToken || config.get('wordpress.bearerToken')
}

module.exports = WordPressProvider
