'use strict'

/**
 * @module Page
 */
const pathToRegexp = require('path-to-regexp')

let _pages = {}

const Page = function (name, schema, hostKey, templateCandidate) {
  schema.settings = schema.settings || {}

  this.name = name // schema.page.name || name
  this.key = schema.page.key || name
  this.hostKey = hostKey || ''
  this.template = schema.template || templateCandidate
  this.contentType = schema.contentType || 'text/html'
  this.datasources = schema.datasources || []
  this.events = schema.events || []
  this.preloadEvents = schema.preloadEvents || []
  this.requiredDatasources = schema.requiredDatasources || []

  this.settings = schema.settings
  this.beautify = this.settings.hasOwnProperty('beautify')
    ? this.settings.beautify
    : false
  this.keepWhitespace = Boolean(this.settings.keepWhitespace)
  this.passFilters = this.settings.hasOwnProperty('passFilters')
    ? this.settings.passFilters
    : false
  this.passHeaders = this.settings.hasOwnProperty('passHeaders')
    ? this.settings.passHeaders
    : false

  checkCacheSetting(schema, this.name)
  checkRouteSetting(schema, this.name)

  this.routes = this.constructRoutes(schema)

  _pages[hostKey + name] = this
}

/**
 * Construct the route property for this page using the page specification
 * JSON loaded from the filesystem
 * @param {Object} schema - the page specification
 * @return {Object}
 * @api public
 */
Page.prototype.constructRoutes = function (schema) {
  let routes = schema.routes || [{ path: '/' + this.name }]

  if (schema.route) {
    if (schema.route.path && typeof schema.route.path === 'string') {
      routes = [{ path: schema.route.path }]
      if (schema.route.constraint) {
        routes[0].constraint = schema.route.constraint
      }
    } else if (schema.route.paths && typeof schema.route.paths === 'string') {
      routes = [{ path: schema.route.paths }]
      if (schema.route.constraint) {
        routes[0].constraint = schema.route.constraint
      }
    }
  }

  // add default params to each route
  routes.forEach(route => {
    route.params = route.params || []
  })

  return routes
}

/**
 * Finds a page route that matches the supplied parameters
 * and using those parameters generates a URL
 * @param {object} params - the parameters used to generate the URL
 * @return {String}
 * @api public
 */
Page.prototype.toPath = function (params) {
  let error
  let url

  this.routes.forEach(route => {
    let keys = pathToRegexp(route.path).keys

    // only attempt this if the route's parameters match those passed to toPath
    let matchingKeys = Object.keys(params).every(param => {
      return keys.filter(key => {
        key.name === param
      })
    })

    if (matchingKeys) {
      try {
        url = pathToRegexp.compile(route.path)(params)
        error = null
      } catch (err) {
        error = err
      }
    }
  })

  if (!url) {
    error = new Error(
      'No routes for page "' +
        this.name +
        '" match the supplied parameters: ' +
        JSON.stringify(params)
    )
  }

  if (!url && error) throw error

  return url
}

/**
 * Checks the page schema contains a valid route setting, otherwise throws an error
 * @param {Object} schema - the page specification
 * @param {String} name - the page name
 * @api private
 */
function checkRouteSetting (schema, name) {
  if (!schema.routes && schema.route && typeof schema.route !== 'object') {
    let newSchema = schema
    newSchema.routes = [{ path: schema.route }]
    delete newSchema.route
    let message =
      '\nThe `route` property for pages has been extended to provide better routing functionality.\n'
    message +=
      "Please modify the route property for page '" +
      name +
      "'. The schema should change to the below:\n\n"
    message += JSON.stringify(newSchema, null, 2) + '\n\n'
    throw new Error(message)
  }
}

/**
 * Checks the page schema contains a valid cache setting, otherwise throws an error
 * @param {Object} schema - the page specification
 * @param {String} name - the page name
 * @api private
 */
function checkCacheSetting (schema, name) {
  if (schema.page.cache !== undefined) {
    schema.settings.cache = schema.page.cache
    delete schema.page.cache

    let message = '\nThe `cache` property should be nested under `settings`.\n'
    message +=
      "Please modify the descriptor file for page '" +
      name +
      "'. The schema should change to the below:\n\n"
    message += JSON.stringify(schema, null, 2) + '\n\n'

    throw new Error(message)
  }
}

// exports
module.exports = function (name, schema, hostKey, templateCandidate) {
  if (name && schema) return new Page(name, schema, hostKey, templateCandidate)
  return _pages[hostKey + name]
}

module.exports.Page = Page
