var _ = require("underscore")
var path = require("path")

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var Datasource = require(path.join(__dirname, '/../datasource'))
var help = require(path.join(__dirname, '/../help'))
var log = require('@dadi/logger')

var Preload = function() {
  this.data = {}
  this.sources = config.get('data.preload')
}

Preload.prototype.init = function (options) {
  _.each(this.sources, (source) => {
    new Datasource(null, source, options, (err, datasource) => {
      if (err) {
        console.log(err)
        return
      }

      var dataHelper = new help.DataHelper(datasource, null)
      dataHelper.load((err, result, dsResponse) => {
        //if (err) return done(err)

        if (result) {
          var results = (typeof result === 'object' ? result : JSON.parse(result))
          this.data[source] = results.results ? results.results : results
        }
      })
    })
  })

  return this
}

Preload.prototype.get = function (key) {
  return this.data[key]
}

var instance
module.exports = function() {
  if (!instance) {
    instance = new Preload()
  }

  return instance
}

module.exports.Preload = Preload