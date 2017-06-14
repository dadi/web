var path = require('path')
var Datasource = require(path.join(__dirname, '/../datasource'))

var RouteValidator = function () {
  this.validationDatasources = {}
}

RouteValidator.prototype.get = function (route, param, options, req) {
  return new Promise((resolve, reject) => {
    var datasource = this.validationDatasources[param.fetch]

    if (!datasource) {
      new Datasource(route.path, param.fetch, options).init((err, ds) => {
        if (err) {
          return reject(err)
        }

        this.validationDatasources[param.fetch] = datasource = ds
      })
    }

    datasource.processRequest(route.path, req)

    return datasource.provider.load(null, (err, result) => {
      if (err) return reject(err)

      if (result) {
        try {
          var results = (typeof result === 'object' ? result : JSON.parse(result))

          if (results.results && results.results.length > 0) {
            return resolve('')
          } else {
            return reject('')
          }
        } catch (e) {
          console.log('RouteValidator Load Error:', datasource.name, datasource.provider.endpoint)
          console.log(e)

          return reject('')
        }
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
