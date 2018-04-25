const path = require('path')
const Datasource = require(path.join(__dirname, '/../datasource'))
const Providers = require(path.join(__dirname, '/../providers'))

const RouteValidator = function () {
  this.validationDatasources = {}
}

RouteValidator.prototype.get = function (route, param, options, req) {
  return new Promise((resolve, reject) => {
    let datasource = this.validationDatasources[param.fetch]

    if (!datasource) {
      new Datasource(route.path, param.fetch, options).init((err, ds) => {
        if (err) return reject(err)

        this.validationDatasources[param.fetch] = datasource = ds
      })
    }

    datasource.provider = new Providers[datasource.source.type]()
    datasource.provider.initialise(datasource, datasource.schema)

    datasource.processRequest(route.path, req)

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

let instance

module.exports = function () {
  if (!instance) {
    instance = new RouteValidator()
  }

  return instance
}
