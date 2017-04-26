/**
 * @module View
 */
var beautify = require('js-beautify')
var path = require('path')
var dust = require(path.join(__dirname, '/../dust'))
var config = require(path.join(__dirname, '/../../../config.js'))

var View = function (url, page, json) {
  this.url = url
  this.page = page
  this.json = json
  this.data = {}

  this.pageTemplate = this.page.template.slice(0, this.page.template.indexOf('.'))
}

View.prototype.setData = function (data) {
  this.data = data
}

View.prototype.render = function (done) {
  if (this.json) {
    // Return the raw data
    return done(null, this.data)
  } else {
    dust.setConfig('whitespace', this.page.keepWhitespace)

    // Render the compiled template
    dust.render(this.pageTemplate, this.data, (err, result) => {
      if (err) {
        console.log(err)
        err.statusCode = 500
        return done(err, null)
      }

      if (config.get('dust.beautify') || this.page.beautify) {
        var options = typeof config.get('dust.beautify') === 'object' ? config.get('dust.beautify') : null

        try {
          if (!this.page.contentType || this.page.contentType === 'text/html') {
            result = beautify.html(result, options)
          } else if (~this.page.contentType.indexOf('javascript') || ~this.page.contentType.indexOf('json')) {
            result = beautify(result, options)
          }
        } catch (e) {
          err = e
        }
      }

      return done(err, result)
    })
  }
}

module.exports = function (url, page, json) {
  return new View(url, page, json)
}

module.exports.View = View
