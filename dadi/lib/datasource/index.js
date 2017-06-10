/**
 * @module Datasource
 */
var _ = require('underscore')
var fs = require('fs')
var path = require('path')
var url = require('url')

var Event = require(path.join(__dirname, '/../event'))
var log = require('@dadi/logger')
var providers = require(path.join(__dirname, '/../providers'))

/**
 * Represents a Datasource.
 * @constructor
 */
var Datasource = function (page, datasource, options) {
  this.page = page
  this.name = datasource
  this.options = options || {}

  Datasource.numInstances = (Datasource.numInstances || 0) + 1
  console.log('Datasource:', Datasource.numInstances, datasource)
}

Datasource.prototype.init = function (callback) {
  this.loadDatasource((err, schema) => {
    if (err) {
      return callback(err)
    }

    this.schema = schema
    this.source = schema.datasource.source
    this.schema.datasource.filter = this.schema.datasource.filter || {}
    this.originalFilter = _.clone(this.schema.datasource.filter)

    if (!this.source.type) {
      this.source.type = 'remote'
    }

    if (!providers[this.source.type]) {
      err = new Error(`no provider available for datasource type ${this.source.type}`, __filename)
      console.error(err.message)
      return callback(err)
    }

    this.provider = new providers[this.source.type]()
    this.filterEvent = null
    this.requestParams = schema.datasource.requestParams || []
    this.chained = schema.datasource.chained || null

    if (schema.datasource.filterEvent) {
      this.filterEvent = new Event(null, schema.datasource.filterEvent, this.options)
    }

    this.provider.initialise(this, schema)

    callback(null, this)
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
 * Process each of the datasource's requestParams, testing for a matching
 * parameter in the querystring (and added to req.params e.g. `/car/:make/:model`) or a matching
 * placeholder in the datasource's endpoint (e.g. `/car/makes/{make}`)
 *
 * Called from lib/controller/index.js:processSearchParameters
 *
 * @param  {string} datasource - datasource key
 * @param  {IncomingMessage} req - the original HTTP request
 */
Datasource.prototype.processRequest = function (datasource, req) {
  this.schema.datasource.filter = this.originalFilter

  var query = JSON.parse(JSON.stringify(url.parse(req.url, true).query))

  // handle the cache flag
  if (query.cache && query.cache === 'false') {
    this.schema.datasource.cache = false
  } else {
    delete this.schema.datasource.cache
  }

  if (req.headers && req.headers.referer) {
    this.schema.datasource.referer = encodeURIComponent(req.headers.referer)
  }

  if (this.page.passHeaders) {
    this.requestHeaders = req.headers
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
    _.each(query, (value, key) => {
      if (key === 'filter') {
        _.extend(this.schema.datasource.filter, JSON.parse(value))
      }
    })
  }

  // Regular expression search for {param.nameOfParam} and replace with requestParameters
  var paramRule = /("\{)(\bparams.\b)(.*?)(\}")/gmi

  this.schema.datasource.filter = JSON.parse(JSON.stringify(this.schema.datasource.filter).replace(paramRule, function (match, p1, p2, p3, p4, offset, string) {
    if (req.params[p3]) {
      return req.params[p3]
    } else {
      return match
    }
  }))

  // Process each of the datasource's requestParams, testing for a matching
  // parameter in the querystring (and added to req.params e.g. `/car/:make/:model`) or a matching
  // placeholder in the datasource's endpoint (e.g. `/car/makes/{make}`)

  // NB don't replace filter properties that already exist
  _.each(this.requestParams, (obj) => {
    // if the requestParam has no 'target' property, it's destined for the filter
    if (!obj.target) obj.target = 'filter'

    var paramValue = req.params.hasOwnProperty(obj.param) && req.params[obj.param]

    if (obj.field && paramValue) {
      paramValue = obj.type === 'Number' ? Number(paramValue) : encodeURIComponent(paramValue)

      if (obj.target === 'filter') {
        this.schema.datasource.filter[obj.field] = paramValue
      } else if (obj.target === 'endpoint') {
        var placeholderRegex = new RegExp('{' + obj.field + '}', 'ig')
        this.source.modifiedEndpoint = this.schema.datasource.source.endpoint.replace(placeholderRegex, paramValue)
      }
    } else {
      if (obj.target === 'filter') {
        // param not found in request, remove it from the datasource filter
        if (this.schema.datasource.filter[obj.field]) {
          delete this.schema.datasource.filter[obj.field]
        }
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
