const path = require('path')

const config = require(path.resolve(path.join(__dirname, '/../../../config')))
const Datasource = require(path.join(__dirname, '/../datasource'))
const Providers = require(path.join(__dirname, '/../providers'))

const Preload = function () {
  this.data = {}
}

Preload.prototype.init = function (options) {
  this.sources = config.get('data.preload')

  this.sources.forEach(source => {
    new Datasource(null, source, options).init((err, datasource) => {
      if (err) {
        console.log(err)
        return
      }

      datasource.provider = new Providers[datasource.source.type]()
      datasource.provider.initialise(datasource, datasource.schema)

      datasource.provider.load(null, (err, data) => {
        if (err) console.log(err)

        datasource.provider = null

        if (data) {
          const results = data
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

Preload.prototype.delete = function (key) {
  delete this.data[key]
}

Preload.prototype.reset = function () {
  this.data = {}
  this.sources = []
}

let instance
module.exports = function () {
  if (!instance) {
    instance = new Preload()
  }

  return instance
}

module.exports.Preload = Preload
