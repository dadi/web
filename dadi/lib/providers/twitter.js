'use strict'

const _ = require('underscore')
const Purest = require('purest')
const config = require(__dirname + '/../../../config.js')

const TwitterProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
TwitterProvider.prototype.initialise = function initialise(datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
  this.twitterApi = new Purest({
    provider: 'twitter',
    key: this.consumerKey,
    secret: this.consumerSecret
  })
}

/**
 * buildQueryParams
 *
 * @return {obj} query params to pass to the twitter api
 */
TwitterProvider.prototype.buildQueryParams = function buildQueryParams() {
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
TwitterProvider.prototype.load = function load(requestUrl, done) {
  try {
    const endpoint = this.schema.datasource.source.endpoint
    const queryParams = this.buildQueryParams()

    this.twitterApi.query()
      .select(endpoint)
      .where(queryParams)
      .auth(this.accessTokenKey, this.accessTokenSecret)
      .request((err, res, body) => {
        if (err) return done(err, null)
        this.processOutput(res, body, done)
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
TwitterProvider.prototype.processOutput = function processOutput(res, data, done) {
  // if the error is anything other than Success or Bad Request, error
  if (res.statusCode && !/200|400/.exec(res.statusCode)) {
    const err = new Error()
    const info = `${res.statusMessage} (${res.statusCode}): ${this.endpoint}`

    err.remoteIp = this.options.host
    err.remotePort = this.options.port
    err.message = `Datasource "${this.datasource.name}" failed. ${info}`
    if (data) err.message += '\n' + data

    log.error({ module: 'helper' }, info)
    return done(err)
  }

  return done(null, data)
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
TwitterProvider.prototype.processRequest = function processRequest(req) {
  // not used
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
TwitterProvider.prototype.setAuthStrategy = function setAuthStrategy() {
  const auth = this.schema.datasource.auth

  this.consumerKey = auth && auth.consumer_key || config.get('twitter.consumerKey')
  this.consumerSecret = auth && auth.consumer_secret || config.get('twitter.consumerSecret')
  this.accessTokenKey = auth && auth.access_token_key || config.get('twitter.accessTokenKey')
  this.accessTokenSecret = auth && auth.access_token_secret || config.get('twitter.accessTokenSecret')
}

module.exports = TwitterProvider
