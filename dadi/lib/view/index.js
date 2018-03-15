'use strict'

/**
 * @module View
 */
const path = require('path')
const templateStore = require(path.join(__dirname, '/../templates/store'))
const config = require(path.join(__dirname, '/../../../config.js'))

const View = function (url, page) {
  this.url = url
  this.page = page
  this.data = {}

  this.templateName =
    this.page.hostKey +
    this.page.template.slice(0, this.page.template.indexOf('.'))

  this.template = templateStore.get(this.templateName)
}

View.prototype.setData = function (data) {
  // data.templatingEngine = this.template.getEngineInfo()

  this.data = data
}

View.prototype.render = function (done) {
  // Send the templated page
  const templateData = Object.assign({}, this.data, {
    host: this.page.hostKey
  })

  this.template
    .render(templateData, {
      keepWhitespace: this.page.keepWhitespace
    })
    .then(raw => {
      let processed = raw

      // Post-process the output
      if (config.get('globalPostProcessors') || this.page.postProcessors) {
        const postProcessors = config
          .get('globalPostProcessors')
          .concat(this.page.postProcessors || [])

        if (this.page.postProcessors !== false) {
          try {
            for (let script of postProcessors) {
              processed = require(path.resolve(
                config.get('paths.processors'),
                script
              ))(this.data, raw)
            }
          } catch (err) {
            return done(err)
          }
        }
      }

      return done(null, processed, raw)
    })
    .catch(err => {
      err.statusCode = 500

      return done(err, null)
    })
}

module.exports = function (url, page, json) {
  return new View(url, page, json)
}

module.exports.View = View
