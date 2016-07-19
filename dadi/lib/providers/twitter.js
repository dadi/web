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
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
TwitterProvider.prototype.load = function load(requestUrl, done) {
  try {
    console.log('this.accessTokenKey', this.accessTokenKey)
    console.log('this.accessTokenSecret', this.accessTokenSecret)
    this.twitterApi.query()
      .select('statuses/user_timeline')
      .where({ screen_name: 'imdsm', count: 10 })
      .auth(this.accessTokenKey, this.accessTokenSecret)
      .request((err, res, body) => {
        if (err) return done(err, null)
        done(null, body)
      })
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
  const auth = this.schema.datasource.auth

  this.consumerKey = auth && auth.consumer_key || config.get('twitter.consumerKey')
  this.consumerSecret = auth && auth.consumer_secret || config.get('twitter.consumerSecret')
  this.accessTokenKey = auth && auth.access_token_key || config.get('twitter.accessTokenKey')
  this.accessTokenSecret = auth && auth.access_token_secret || config.get('twitter.accessTokenSecret')
}

module.exports = TwitterProvider
