'use strict'

const _ = require('underscore')

const StaticProvider = function () {}

StaticProvider.prototype.initialise = function (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
}

StaticProvider.prototype.processRequest = function () {
  // do nothing, build no end point
}

StaticProvider.prototype.load = function (requestUrl, done) {
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
