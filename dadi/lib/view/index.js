/**
 * @module View
 */
var fs = require('fs');
var path = require('path');
var dust = require(__dirname + '/../dust');
var beautify_html = require('js-beautify').html;
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');
var app = require(__dirname + '/../');

var View = function (url, page, json) {
  this.url = url;
  this.page = page;
  this.json = json;
  this.data = {};

  this.pageTemplate = this.page.template.slice(0, this.page.template.indexOf('.'));
}

View.prototype.setData = function(data) {
  this.data = data;
}

View.prototype.render = function(done) {
  var self = this;

  if (self.json) {
    // Return the raw data
    return done(null, this.data);
  }
  else {
    dust.setConfig('whitespace', this.page.keepWhitespace);

    // Render the compiled template
    dust.render(this.pageTemplate, this.data, function(err, result) {

      if (err) {
        console.log(err)
        err.statusCode = 500;
        return done(err, null);
      }

      if (self.page.beautify) {
        try {
          result = beautify_html(result);
        }
        catch (e) {
          err = e;
        }
      }

      return done(err, result);
    });
  }
}

module.exports = function (url, page, json) {
  return new View(url, page, json);
};

module.exports.View = View;
