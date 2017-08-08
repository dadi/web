'use strict'

const _ = require('underscore')

const StaticProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
StaticProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
StaticProvider.prototype.load = function load (requestUrl, done) {
  let data = this.schema.datasource.source.data

  const params = this.datasourceParams
    ? this.datasourceParams
    : this.schema.datasource

  if (Array.isArray(data)) {
    const sort = params.sort
    const search = params.search
    const count = params.count
    const fields = params.fields || []

    if (search) data = _.where(data, search)

    // apply a filter
    data = _.where(data, params.filter)

    // Sort by field (with date support)
    if (sort && Object.keys(sort).length > 0) {
      Object.keys(sort).forEach(field => {
        data = _.sortBy(data, post => {
          const value = post[field]
          const valueAsDate = new Date(value)
          return valueAsDate.toString() !== 'Invalid Date'
            ? +valueAsDate
            : value
        })
        if (sort[field] === -1) {
          data = data.reverse()
        }
      })
    }

    if (count) data = _.first(data, count)
    if (fields && !_.isEmpty(fields)) {
      data = _.chain(data).selectFields(fields.join(',')).value()
    }
  }

  done(null, { results: Array.isArray(data) ? data : [data] })
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
StaticProvider.prototype.processRequest = function (datasourceParams) {
  this.datasourceParams = datasourceParams
}

module.exports = StaticProvider
