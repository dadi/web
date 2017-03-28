/**
 * @module View
 */
var beautifyHtml = require('js-beautify').html
var path = require('path')
var dust = require(path.join(__dirname, '/../dust'))

var View = function (url, page, json) {
  this.url = url
  this.page = page
  this.json = json
  this.data = {}

  this.pageTemplate = this.page.hostKey + this.page.template.slice(0, this.page.template.indexOf('.'))
}

View.prototype.setData = function (data) {
  data.templatingEngine = {
    engine: 'dust',
    version: dust.getEngine().version
  }

  this.data = data
}

View.prototype.render = function (done) {
  if (this.json) {
    // Return the raw data
    return done(null, this.data)
  } else {
    dust.setConfig('whitespace', this.page.keepWhitespace)

    var ctx = dust.getEngine().context(null, { host: this.page.hostKey })

    // Render the compiled template
    dust.render(this.pageTemplate, ctx.push(this.data), (err, result) => {
      if (err) {
        err.statusCode = 500
        return done(err, null)
      }

      if (this.page.beautify) {
        try {
          result = beautifyHtml(result)
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
