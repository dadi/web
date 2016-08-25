var _ = require("underscore")
var path = require("path")

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var Datasource = require(path.join(__dirname, '/../datasource'))
var help = require(path.join(__dirname, '/../help'))
var log = require('@dadi/logger')

var RouteValidator = function(route, param, options) {
  this.route = route
  this.param = param
  this.options = options
  this.data = {}
}

RouteValidator.prototype.get = function (req) {
  return new Promise((resolve, reject) => {
    new Datasource(this.route.path, this.param.fetch, this.options, (err, datasource) => {
      if (err) {
        if (err) return reject(err)
      }

      datasource.processRequest(this.route.path, req)

      var dataHelper = new help.DataHelper(datasource, null)
      dataHelper.load((err, result, dsResponse) => {
        if (err) return reject(err)

        console.log(result)

        if (result) {
          var results = (typeof result === 'object' ? result : JSON.parse(result))
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

module.exports = function(route, param, options) {
  return new RouteValidator(route, param, options)
}

module.exports.RouteValidator = RouteValidator