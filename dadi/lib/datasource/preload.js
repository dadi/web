var _ = require('underscore')
var path = require('path')

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var Datasource = require(path.join(__dirname, '/../datasource'))

var Preload = function () {
  this.data = {}
}

Preload.prototype.init = function (options) {
  this.sources = config.get('data.preload')

  _.each(this.sources, (source) => {
    new Datasource(null, source, options).init((err, datasource) => {
      if (err) {
        console.log(err)
        return
      }

      datasource.provider.load(null, (err, result) => {
        if (err) console.log(err)
        if (result) {
          try {
            var results = (typeof result === 'object' ? result : JSON.parse(result))
            this.data[source] = results.results ? results.results : results
          } catch (e) {
            console.log('Preload Load Error:', datasource.name, datasource.provider.endpoint)
            console.log(e)
          }
        }
      })
    })
  })

  return this
}

Preload.prototype.get = function (key) {
  return this.data[key]
}

Preload.prototype.delete = function (key) {
  delete this.data[key]
}

Preload.prototype.reset = function () {
  this.data = {}
  this.sources = []
}

var instance
module.exports = function () {
  if (!instance) {
    instance = new Preload()
  }

  return instance
}

module.exports.Preload = Preload
