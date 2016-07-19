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
StaticProvider.prototype.initialise = function initialise(datasource, schema) {
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
StaticProvider.prototype.load = function load(requestUrl, done) {
  try {
    let data = this.schema.datasource.source.data

    if (_.isArray(data)) {
      const sortField = this.schema.datasource.sort.field
      const sortDir = this.schema.datasource.sort.order
      const search = this.schema.datasource.search
      const count = this.schema.datasource.count
      const fields = this.schema.datasource.fields

      if (search) data = _.where(data, search)
      if (sortField) data = _.sortBy(data, sortField)
      if (sortDir === 'desc') data = data.reverse()

      if (count) data = _.first(data, count)
      if (fields) data = _.chain(data).selectFields(fields.join(',')).value()
    }

    done(null, data)
  } catch (ex) {
    done(ex, null)
  }
}

module.exports = StaticProvider
