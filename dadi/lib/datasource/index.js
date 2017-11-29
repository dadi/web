/**
 * @module Datasource
 */
const fs = require('fs')
const getValue = require('get-value')
const path = require('path')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config.js'))
const Event = require(path.join(__dirname, '/../event'))
const log = require('@dadi/logger')
const providers = require(path.join(__dirname, '/../providers'))

/**
 * Represents a Datasource.
 * @constructor
 */
const Datasource = function (page, datasource, options) {
  this.page = page
  this.name = datasource
  this.options = options || {}

  Datasource.numInstances = (Datasource.numInstances || 0) + 1
  // console.log('Datasource:', Datasource.numInstances, datasource)
}

Datasource.prototype.init = function (callback) {
  this.loadDatasource((err, schema) => {
    if (err) {
      return callback(err)
    }

    this.schema = schema
    this.source = schema.datasource.source
    this.schema.datasource.filter = this.schema.datasource.filter || {}
    this.originalFilter = Object.assign({}, this.schema.datasource.filter)

    if (!this.source.type) {
      this.source.type = 'dadiapi'
    }

    if (!providers[this.source.type]) {
      err = new Error(
        `no provider available for datasource type ${this.source.type}`,
        __filename
      )
      console.error(err.message)
      return callback(err)
    }

    this.provider = new providers[this.source.type]()
    this.filterEvent = null
    this.requestParams = schema.datasource.requestParams || []
    this.chained = schema.datasource.chained || null

    if (schema.datasource.filterEvent) {
      this.filterEvent = new Event(
        null,
        schema.datasource.filterEvent,
        this.options
      )
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
  const filepath =
    (this.options.datasourcePath || '') + '/' + this.name + '.json'
  let schema

  try {
    const body = fs.readFileSync(filepath, { encoding: 'utf-8' })

    schema = JSON.parse(body)
    done(null, schema)
  } catch (err) {
    log.error(
      { module: 'datasource' },
      { err: err },
      'Error loading datasource schema "' + filepath + '". Is it valid JSON?'
    )
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
  let datasourceParams = Object.assign({}, this.schema.datasource)
  datasourceParams.filter = this.originalFilter || {}

  let query = JSON.parse(JSON.stringify(url.parse(req.url, true).query))

  // handle the cache flag
  if (query.cache && query.cache === 'false') {
    // this.schema.datasource.cache = false
    datasourceParams.cache = false
  } else {
    // delete this.schema.datasource.cache
    delete datasourceParams.cache
  }

  // if (req.headers && req.headers.referer) {
  //   this.schema.datasource.referer = encodeURIComponent(req.headers.referer)
  // }

  if (this.page.passHeaders) {
    this.requestHeaders = req.headers
  }

  // if the current datasource matches the page name
  // add some params from the query string or request params
  if (
    (this.page.name && datasource.indexOf(this.page.name) >= 0) ||
    this.page.passFilters
  ) {
    const requestParamsPage = this.requestParams.find(obj => {
      return obj.queryParam === 'page' && obj.param
    })

    // handle pagination param
    if (datasourceParams.paginate) {
      datasourceParams.page =
        query.page ||
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
    Object.keys(query).forEach(key => {
      if (key === 'filter') {
        datasourceParams.filter = Object.assign(
          datasourceParams.filter,
          JSON.parse(query[key])
        )
      }
    })
  }

  // Regular expression search for {param.nameOfParam} and replace with requestParameters
  const paramRule = /("\{)(\bparams.\b)(.*?)(\}")/gim

  datasourceParams.filter = JSON.parse(
    JSON.stringify(datasourceParams.filter).replace(paramRule, function (
      match,
      p1,
      p2,
      p3,
      p4,
      offset,
      string
    ) {
      if (req.params[p3]) {
        return req.params[p3]
      } else {
        return match
      }
    })
  )

  // Process each of the datasource's requestParams, testing for a matching
  // parameter in the querystring (and added to req.params e.g. `/car/:make/:model`) or a matching
  // placeholder in the datasource's endpoint (e.g. `/car/makes/{make}`)

  let endpoint = this.schema.datasource.source.endpoint

  // NB don't replace filter properties that already exist
  this.requestParams.forEach(param => {
    let value = this.getParameterValue(req, param)

    // if the requestParam has no 'target' property,
    // it's destined for the filter
    param.target = param.target || 'filter'

    if (param.field && value) {
      if (param.target === 'endpoint') {
        const placeholderRegex = new RegExp('{' + param.field + '}', 'ig')
        endpoint = endpoint.replace(placeholderRegex, value)
      } else {
        datasourceParams.filter[param.field] = value
      }
    } else {
      if (param.target === 'filter') {
        // param not found in request, remove it from the datasource filter
        if (datasourceParams.filter[param.field]) {
          delete datasourceParams.filter[param.field]
        }
      }
    }
  })

  this.source.modifiedEndpoint = endpoint

  // extend the existing filter with the result of a filterEvent
  if (this.schema.datasource.filterEventResult) {
    datasourceParams.filter = Object.assign(
      datasourceParams.filter,
      this.schema.datasource.filterEventResult
    )
  }

  if (typeof this.provider.processRequest === 'function') {
    if (
      this.provider.hasOwnProperty('processSchemaParams') &&
      this.provider.processSchemaParams === false
    ) {
      this.provider.processRequest(req)
    } else {
      this.provider.processRequest(datasourceParams)
    }
  }
}

/**
 * Gets the value of the specified parameter from the specified source
 *
 * @param {Object} req - the original HTTP request
 * @param {Object} parameter - the parameter object, contains source, target, parameter key, i.e. the path to the required property
 * @returns {String|Number} the value associated with the specified parameter, or null
 */
Datasource.prototype.getParameterValue = function (req, parameter) {
  let value = null

  switch (parameter.source) {
    case 'config':
      value = config.get(parameter.param)
      break
    case 'session':
      value = req.session && getValue(req.session, parameter.param)
      break
    default:
      value = req.params && req.params[parameter.param]
      break
  }

  if (value) {
    if (parameter.type === 'Number') {
      value = Number(value)
    } else {
      value = encodeURIComponent(value)
    }
  }

  return value
}

module.exports = function (page, datasource, options, callback) {
  return new Datasource(page, datasource, options, callback)
}

module.exports.Datasource = Datasource
