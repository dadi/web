'use strict'

const _ = require('underscore')
const Purest = require('purest')
const provider = new Purest({ provider: 'twitter' })

const TwitterProvider = function () {}

TwitterProvider.prototype.initialise = function (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.setAuthStrategy()
}

TwitterProvider.prototype.load = function (requestUrl, done) {
  try {
    let data = []

    // TODO

    done(null, data)
  } catch (ex) {
    done(ex, null)
  }
}

TwitterProvider.prototype.processRequest = function () {
  // do nothing, build no end point
}

TwitterProvider.prototype.setAuthStrategy = function() {
  if (!this.schema.datasource.auth) return

  this.accessTokenKey = this.schema.datasource.auth.access_token_key || ''
  this.accessTokenSecret = this.schema.datasource.auth.access_token_secret || ''
}

TwitterProvider.prototype.test = function () {
  // provider.query()
  //   .select('users/show')
  //   .where({ screen_name: 'imdsm' })
  //   .auth(this.accessTokenKey, this.accessTokenSecret)
  //   .request(function (err, res, body) {
  //     if (err) console.log(err)
  //     console.log('body.name:', body.name)
  //     console.log('body.screen_name:', body.screen_name)
  //   })
}

module.exports = TwitterProvider
