'use strict'

const path = require('path')
const help = require(path.join(__dirname, '../help'))

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

    // apply search
    data = help.where(data, search)

    // apply filter
    data = help.where(data, params.filter)

    // Sort by field (with date support)
    if (sort && Object.keys(sort).length > 0) {
      Object.keys(sort).forEach(field => {
        data.sort(
          help.sortBy(field, value => {
            if (field.toLowerCase().includes('date')) {
              value = new Date(value)
            }

            return value
          })
        )

        if (sort[field] === -1) {
          data.reverse()
        }
      })
    }

    if (count) {
      data = data.slice(0, count)
    }

    if (fields && fields.length > 0) {
      if (Array.isArray(data)) {
        let i = 0
        data.forEach(document => {
          data[i] = help.pick(data[i], fields)
          i++
        })
      } else {
        data = help.pick([data], fields)
      }
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
