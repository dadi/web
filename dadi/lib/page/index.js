/**
 * @module Page
 */
var _ = require('underscore')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var config = require(path.join(__dirname, '/../../../config'))

var _pages = {}

var Page = function (name, schema) {
  schema.settings = schema.settings || {}

  this.name = name // schema.page.name || name
  this.key = schema.page.key || name
  this.template = schema.template || name + '.dust'
  this.contentType = schema.contentType || 'text/html'
  this.datasources = schema.datasources || []
  this.events = schema.events || []
  this.preloadEvents = schema.preloadEvents || []
  this.requiredDatasources = schema.requiredDatasources || []

  this.settings = schema.settings
  this.beautify = this.settings.hasOwnProperty('beautify') ? this.settings.beautify : false
  this.keepWhitespace = getWhitespaceSetting(this.settings)
  this.passFilters = this.settings.hasOwnProperty('passFilters') ? this.settings.passFilters : false

  checkCacheSetting(schema, this.name)
  checkRouteSetting(schema, this.name)

  this.routes = this.constructRoutes(schema)

  _pages[name] = this
}

/**
 * Construct the route property for this page using the page specification
 * JSON loaded from the filesystem
 * @param {Object} schema - the page specification
 * @return {Object}
 * @api public
 */
Page.prototype.constructRoutes = function (schema) {
  var routes = schema.routes || [{ 'path': '/' + this.name }]

  if (schema.route) {
    if (schema.route.path && typeof schema.route.path === 'string') {
      routes = [{ 'path': schema.route.path }]
      if (schema.route.constraint) routes[0].constraint = schema.route.constraint
    } else if (schema.route.paths && typeof schema.route.paths === 'string') {
      routes = [{ 'path': schema.route.paths }]
      if (schema.route.constraint) routes[0].constraint = schema.route.constraint
    }
  }

  // add default params to each route
  _.each(routes, (route) => {
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
  var error
  var url

  this.routes.forEach((route) => {
    var keys = pathToRegexp(route.path).keys

    // only attempt this if the route's parameters match those passed to toPath
    if (_.difference(_.pluck(keys, 'name'), Object.keys(params)).length === 0) {
      try {
        url = pathToRegexp.compile(route.path)(params)
        error = null
      } catch (err) {
        error = err
      }
    }
  })

  if (!url) {
    error = new Error('No routes for page "' + this.name + '" match the supplied number of parameters')
  }

  if (!url && error) throw error

  return url
}

function getWhitespaceSetting (settings) {
  var dustConfig = config.get('dust')
  var whitespace = true

  if (dustConfig && dustConfig.hasOwnProperty('whitespace')) {
    whitespace = dustConfig.whitespace
  }

  if (settings.hasOwnProperty('keepWhitespace')) {
    whitespace = settings.keepWhitespace
  }

  return whitespace
}

/**
 * Checks the page schema contains a valid route setting, otherwise throws an error
 * @param {Object} schema - the page specification
 * @param {String} name - the page name
 * @api private
 */
function checkRouteSetting (schema, name) {
  if (!schema.routes && schema.route && typeof schema.route !== 'object') {
    var newSchema = schema
    newSchema.routes = [{ 'path': schema.route }]
    delete newSchema.route
    var message = '\nThe `route` property for pages has been extended to provide better routing functionality.\n'
    message += "Please modify the route property for page '" + name + "'. The schema should change to the below:\n\n"
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

    var message = '\nThe `cache` property should be nested under `settings`.\n'
    message += "Please modify the descriptor file for page '" + name + "'. The schema should change to the below:\n\n"
    message += JSON.stringify(schema, null, 2) + '\n\n'

    throw new Error(message)
  }
}

// exports
module.exports = function (name, schema) {
  if (name && schema) return new Page(name, schema)
  return _pages[name]
}

module.exports.Page = Page
