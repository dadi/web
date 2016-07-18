/*
 * TODO: move API related things to here
 */

var BearerAuthStrategy = require(__dirname + '/../auth/bearer')

var ApiProvider = function () {}

ApiProvider.prototype.initialise = function (schema) {
  this.schema = schema
  this.setAuthStrategy()
  this.buildEndpoint()
}

ApiProvider.prototype.setAuthStrategy = function () {
  if (!this.schema.datasource.auth) return null
  this.authStrategy = new BearerAuthStrategy(this.schema.datasource.auth)
}

/**
 *  Constructs the datasource endpoint using properties defined in the schema
 *  @param {JSON} schema - ?
 *  @param done - the callback that handles the response
 *  @public
 */
ApiProvider.prototype.buildEndpoint = function (schema, done) {
  var self = this
  var schema = this.schema
  var uri = ''

  var apiConfig = config.get('api')

  var protocol = schema.datasource.source.protocol || 'http'
  var host = schema.datasource.source.host || apiConfig.host
  var port = schema.datasource.source.port || apiConfig.port

  uri = [protocol, '://', host, (port !== '' ? ':' : ''), port, '/', schema.datasource.source.endpoint].join('')

  self.endpoint = self.processDatasourceParameters(schema, uri)
}

/**
 *  Adds querystring parameters to the datasource endpoint using properties defined in the schema
 *  @param {JSON} schema - the datasource schema
 *  @param {String} uri - the original datasource endpoint
 *  @public
 */
ApiProvider.prototype.processDatasourceParameters = function (schema, uri) {

  var query = '?';

  var params = [
    {"count": (schema.datasource.count || 0)},
    {"skip": (schema.datasource.skip)},
    {"page": (schema.datasource.page || 1)},
    {"referer": schema.datasource.referer},
    {"filter": schema.datasource.filter || {}},
    {"fields": schema.datasource.fields || {}},
    {"sort": processSortParameter(schema.datasource.sort)}
  ];

  // pass cache flag to API endpoint
  if (schema.datasource.hasOwnProperty('cache')) {
    params.push({"cache": schema.datasource.cache});
  }

  params.forEach(function(param) {
    for (key in param) {
      if (param.hasOwnProperty(key) && (typeof param[key] !== 'undefined')) {
        query = query + key + "=" + (_.isObject(param[key]) ? JSON.stringify(param[key]) : param[key]) + '&';
      }
    }
    // if (params.indexOf(param) === (params.length-1)) {
    //   done(uri + query.slice(0,-1));
    // }
  });

  return uri + query.slice(0,-1);
}

module.exports = ApiProvider
