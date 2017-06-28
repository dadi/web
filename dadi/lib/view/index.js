'use strict'

/**
 * @module View
 */
const _ = require('underscore')
const beautifyHtml = require('js-beautify').html
const path = require('path')
const templateStore = require(path.join(__dirname, '/../templates/store'))

const View = function (url, page, json) {
  this.url = url
  this.page = page
  this.json = json
  this.data = {}

  this.templateName =
    this.page.hostKey +
    this.page.template.slice(0, this.page.template.indexOf('.'))

  this.template = templateStore.get(this.templateName)
}

View.prototype.setData = function (data) {
  data.templatingEngine = this.template.getEngineInfo()

  this.data = data
}

View.prototype.render = function (done) {
  if (this.json) {
    // Return the raw data
    return done(null, this.data)
  } else {
    let templateData = _.extend(
      {
        host: this.page.hostKey
      },
      this.data
    )

    this.template
      .render(templateData, {
        keepWhitespace: this.page.keepWhitespace
      })
      .then(output => {
        let err = null

        if (this.page.beautify) {
          try {
            output = beautifyHtml(output)
          } catch (error) {
            err = error
          }
        }

        return done(err, output)
      })
      .catch(err => {
        err.statusCode = 500

        return done(err, null)
      })
  }
}

module.exports = function (url, page, json) {
  return new View(url, page, json)
}

module.exports.View = View
