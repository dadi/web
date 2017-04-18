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

  if (Array.isArray(data)) {
    const sort = this.schema.datasource.sort
    const search = this.schema.datasource.search
    const count = this.schema.datasource.count
    const fields = this.schema.datasource.fields || []

    if (search) data = _.where(data, search)

    // apply a filter
    data = _.where(data, this.schema.datasource.filter)

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

module.exports = StaticProvider
