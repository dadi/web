const path = require('path')

const config = require(path.resolve(path.join(__dirname, '/../../../config')))
const Datasource = require(path.join(__dirname, '/../datasource'))
const Providers = require(path.join(__dirname, '/../providers'))

class Preload {
  constructor () {
    this.data = {}
  }

  init (options) {
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

  get (key) {
    return this.data[key]
  }

  delete (key) {
    delete this.data[key]
  }

  reset () {
    this.data = {}
    this.sources = []
  }
}

let instance
module.exports = function () {
  if (!instance) {
    instance = new Preload()
  }

  return instance
}

module.exports.Preload = Preload
