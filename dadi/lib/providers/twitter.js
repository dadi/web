'use strict'

const _ = require('underscore')
const Purest = require('purest')
const provider = new Purest({ provider: 'twitter' })

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
    let data = []

    // TODO

    done(null, data)
  } catch (ex) {
    done(ex, null)
  }
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @return {void}
 */
TwitterProvider.prototype.processRequest = function processRequest() {
  // this.buildEndpoint()
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
TwitterProvider.prototype.setAuthStrategy = function setAuthStrategy() {
  if (!this.schema.datasource.auth) return

  this.accessTokenKey = this.schema.datasource.auth.access_token_key || ''
  this.accessTokenSecret = this.schema.datasource.auth.access_token_secret || ''
}

module.exports = TwitterProvider
