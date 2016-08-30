/**
 * @module Datasource
 */
var fs = require('fs')
var url = require('url')
var _ = require('underscore')

var Event = require(__dirname + '/../event')
var config = require(__dirname + '/../../../config.js')
var log = require('@dadi/logger')
var providers = require(__dirname + '/../providers')

/**
 * Represents a Datasource.
 * @constructor
 */
var Datasource = function (page, datasource, options, callback) {
  this.page = page
  this.name = datasource
  this.options = options || {}

  var self = this

  this.loadDatasource(function (err, schema) {
    if (err) {
      return callback(err)
    }

    self.schema = schema
    self.source = schema.datasource.source
    self.schema.datasource.filter = self.schema.datasource.filter || {}

    if (!self.source.type) {
      self.source.type = 'remote'
    }

    if (self.source.type === 'static') {
      callback(null, self)
    }

    if (!providers[self.source.type]) {
      err = new Error(`no provider available for datasource type ${self.source.type}`, __filename)
      console.error(err.message)
      return callback(err)
    }

    self.provider = new providers[self.source.type]()
    self.filterEvent = null
    self.requestParams = schema.datasource.requestParams || []
    self.chained = schema.datasource.chained || null

    if (schema.datasource.filterEvent) {
      self.filterEvent = new Event(null, schema.datasource.filterEvent, self.options)
    }

    self.provider.initialise(self, schema)

    callback(null, self)
  })
}

/**
 * Callback for loading a datasource schema.
 *
 * @callback loadDatasourceCallback
 * @param {Error} err - An error occurred whilst trying to load the datasource schema.
 * @param {JSON} result - the datasource schema.
 */

/**
 *  Reads a datasource schema from the filesystem
 *  @param {loadDatasourceCallback} done - the callback that handles the response
 *  @public
 */
Datasource.prototype.loadDatasource = function (done) {
  var filepath = (this.options.datasourcePath || '') + '/' + this.name + '.json'
  var schema

  try {
    var body = fs.readFileSync(filepath, {encoding: 'utf-8'})

    schema = JSON.parse(body)
    done(null, schema)
  } catch (err) {
    log.error({module: 'datasource'}, {'err': err}, 'Error loading datasource schema "' + filepath + '". Is it valid JSON?')
    done(err)
  }
}

/**
 * @param  {string} datasource - datasource key
 */
Datasource.prototype.processRequest = function (datasource, req) {
  // called from lib/controller:processSearchParameters for reason:
  // | process each of the datasource's requestParams, testing for their existence
  // | in the querystring's request params e.g. /car-reviews/:make/:model

  var originalFilter = _.clone(this.schema.datasource.filter)
  var query = url.parse(req.url, true).query

  // handle the cache flag
  if (query.hasOwnProperty('cache') && query.cache === 'false') {
    this.schema.datasource.cache = false
  } else {
    delete this.schema.datasource.cache
  }

  if (req.headers && req.headers.referer) {
    this.schema.datasource.referer = encodeURIComponent(req.headers.referer)
  }

  // if the current datasource matches the page name
  // add some params from the query string or request params
  if ((this.page.name && datasource.indexOf(this.page.name) >= 0) || this.page.passFilters) {
    var requestParamsPage = this.requestParams.find((obj) => {
      return (obj.queryParam === 'page') && obj.param
    })

    // handle pagination param
    if (this.schema.datasource.paginate) {
      this.schema.datasource.page = query.page ||
        (requestParamsPage && req.params[requestParamsPage]) ||
        req.params.page ||
        1
    }

    // add an ID filter if it was present in the querystring
    // either as http://www.blah.com?id=xxx or via a route parameter e.g. /books/:id
    if (req.params.id || query.id) {
      //  this.schema.datasource.filter['_id'] = req.params.id || query.id
      delete query.id
    }

    // URI encode each querystring value
    _.each(query, function (value, key) {
      if (key === 'filter') {
        _.extend(this.schema.datasource.filter, JSON.parse(value))
      }
    }, this)
  }

  // Regular expression search for {param.nameOfParam} and replace with requestParameters
  var paramRule = /(\"\{)(\bparams.\b)(.*?)(\}\")/gmi
  this.schema.datasource.filter = JSON.parse(JSON.stringify(this.schema.datasource.filter).replace(paramRule, function (match, p1, p2, p3, p4, offset, string) {
    if (req.params[p3]) {
      return req.params[p3]
    } else {
      return match
    }
  }.bind(this)))

  // add the datasource's requestParams, testing for their existence
  // in the querystring's request params e.g. /car-reviews/:make/:model
  // NB don't replace a property that already exists
  _.each(this.requestParams, (obj) => {
    if (obj.field && req.params.hasOwnProperty(obj.param)) {
      if (obj.type == 'Number') {
        this.schema.datasource.filter[obj.field] = Number(req.params[obj.param])
      } else {
        this.schema.datasource.filter[obj.field] = encodeURIComponent(req.params[obj.param])
      }
    } else {
      // param not found in request, remove it from DS filter
      if (this.schema.datasource.filter[obj.field]) {
        delete this.schema.datasource.filter[obj.field]
      }
    }
  })

  if (this.schema.datasource.filterEventResult) {
    this.schema.datasource.filter = _.extend(this.schema.datasource.filter, this.schema.datasource.filterEventResult)
  }

  if (typeof this.provider.processRequest === 'function') {
    this.provider.processRequest(req)
  }
}

module.exports = function (page, datasource, options, callback) {
  return new Datasource(page, datasource, options, callback)
}

module.exports.Datasource = Datasource
