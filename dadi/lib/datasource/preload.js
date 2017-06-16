var _ = require('underscore')
var path = require('path')

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var Datasource = require(path.join(__dirname, '/../datasource'))
var Providers = require(path.join(__dirname, '/../providers'))

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

      datasource.provider = new Providers[datasource.source.type]()
      datasource.provider.initialise(datasource, datasource.schema)

      // var requestUrl = datasource.processRequest('preload', req)
      // datasource.processRequest('preload', null)

      // datasource.provider.load(requestUrl, (err, data) => {
      datasource.provider.load(null, (err, data) => {
        if (err) console.log(err)

        if (datasource.provider.destroy) {
          datasource.provider.destroy()
        }

        datasource.provider = null

        // TODO: simplify this, doesn't require a try/catch
        if (data) {
          try {
            var results = data
            this.data[source] = results.results ? results.results : results
          } catch (e) {
            console.log('Preload Load Error:', datasource.name)
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
