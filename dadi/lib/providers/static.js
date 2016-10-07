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
 * processSortParameter
 *
 * @param  {?} obj - sort parameter
 * @return {?}
 */
StaticProvider.prototype.processSortParameter = function processSortParameter (obj) {
  let sort = {}

  if (typeof obj !== 'object' || obj === null) return sort

  if (_.isArray(obj)) {
    _.each(obj, (value, key) => {
      if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
        sort[value.field] = (value.order === 'asc') ? 1 : -1
      }
    })
  } else if (obj.hasOwnProperty('field') && obj.hasOwnProperty('order')) {
    sort[obj.field] = (obj.order === 'asc') ? 1 : -1
  } else {
    sort = obj
  }

  return sort
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
StaticProvider.prototype.load = function load (requestUrl, done) {
  try {
    let data = this.schema.datasource.source.data

    this.schema.datasource.sort = this.processSortParameter(this.schema.datasource.sort)

    if (_.isArray(data)) {
      const sortField = this.schema.datasource.sort.field
      const sortDir = this.schema.datasource.sort.order
      const search = this.schema.datasource.search
      const count = this.schema.datasource.count
      const fields = this.schema.datasource.fields || []

      if (search) data = _.where(data, search)

      // apply a filter
      data = _.where(data, this.schema.datasource.filter)
      console.log(data)

      if (sortField) data = _.sortBy(data, sortField)
      if (sortDir === 'desc') data = data.reverse()

      console.log(data)

      if (count) data = _.first(data, count)
      if (fields && !_.isEmpty(fields)) data = _.chain(data).selectFields(fields.join(',')).value()



      console.log(data)
    }

    done(null, { results: data })
  } catch (ex) {
    done(ex, null)
  }
}

module.exports = StaticProvider
