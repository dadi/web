var path = require('path')
var Datasource = require(path.join(__dirname, '/../datasource'))

var RouteValidator = function (route, param, options) {
  this.route = route
  this.param = param
  this.options = options
  this.data = {}
}

RouteValidator.prototype.get = function (req) {
  return new Promise((resolve, reject) => {
    new Datasource(
      this.route.path,
      this.param.fetch,
      this.options
    ).init((err, datasource) => {
      if (err) return reject(err)

      datasource.processRequest(this.route.path, req)

      datasource.provider.load(null, (err, result) => {
        if (err) return reject(err)

        if (result) {
          var results = typeof result === 'object' ? result : JSON.parse(result)
          if (results.results && results.results.length > 0) {
            return resolve('')
          } else {
            return reject('')
          }
        }
      })
    })
  })
}

module.exports = function (route, param, options) {
  return new RouteValidator(route, param, options)
}

module.exports.RouteValidator = RouteValidator
