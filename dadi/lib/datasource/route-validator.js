var path = require('path')
var Datasource = require(path.join(__dirname, '/../datasource'))
var Providers = require(path.join(__dirname, '/../providers'))

var RouteValidator = function () {
  this.validationDatasources = {}
}

RouteValidator.prototype.get = function (route, param, options, req) {
  return new Promise((resolve, reject) => {
    var datasource = this.validationDatasources[param.fetch]

    if (!datasource) {
      new Datasource(route.path, param.fetch, options).init((err, ds) => {
        if (err) return reject(err)

        this.validationDatasources[param.fetch] = datasource = ds
      })
    }

    datasource.provider = new Providers[datasource.source.type]()
    datasource.provider.initialise(datasource, datasource.schema)

    // var requestUrl = datasource.processRequest(route.path, req)
    datasource.processRequest(route.path, req)

    // return datasource.provider.load(requestUrl, (err, data) => {
    return datasource.provider.load(req.url, (err, data) => {
      if (err) return reject(err)

      datasource.provider = null

      if (data && data.results && data.results.length > 0) {
        return resolve('')
      } else {
        return reject('')
      }
    })
  })
}

var instance

module.exports = function () {
  if (!instance) {
    instance = new RouteValidator()
  }

  return instance
}

// module.exports.RouteValidator = RouteValidator
