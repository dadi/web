var fs = require('fs');
var path = require('path');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var commonDustHelpers = require('common-dustjs-helpers');
var beautify_html = require('js-beautify').html;
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');

var View = function (url, page, json) {
  this.url = url;
  this.page = page;
  this.json = json;
  this.data = {};

  var self = this;

  this.pageTemplate = this.page.template.slice(0, this.page.template.indexOf('.'));
  this.template = _.find(_.keys(dust.cache), function (k) { return k.indexOf(self.pageTemplate) > -1; });

  this.loadTemplateHelpers();
}

View.prototype.setData = function(data) {
  this.data = data;
}

View.prototype.render = function(done) {

  var self = this;

  if (!this.template) {
    var err = new Error();
    err.name = "DustTemplate";
    err.message = "Template not found: '" + this.page.template + "'. (Rendering page '" + this.page.key + "')";
    err.path = this.url;
    throw err;
  }

  // add common dust helpers
  new commonDustHelpers.CommonDustjsHelpers().export_helpers_to(dust);

  if (self.json) {
    // Return the raw data
    return done(null, this.data);
  }
  else {
    dust.config.whitespace = this.page.keepWhitespace;

    // Render the compiled template
    dust.render(this.pageTemplate, this.data, function(err, result) {

      if (err) {
        err = new Error(err.message);
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

/**
 *  Load all files located in the specified path
 *  @api public
 */
View.prototype.loadFiles = function(pathToHelpers) {

  // test the requested path
  try {
    var stats = fs.statSync(pathToHelpers);
  }
  catch (err) {
    throw err;
  }

  fs.readdirSync(pathToHelpers).sort().forEach(function(file) {
    var filepath = path.resolve(pathToHelpers + '/' + file);
    stats = fs.statSync(filepath);
    if (stats.isFile() && file.slice(-3) === '.js') {

      require(filepath);
    }
  });
}

/**
 *  Load all files located in app/utils/helpers && app/utils/filters (or configured alternatives)
 *  @api public
 */
View.prototype.loadTemplateHelpers = function() {
  var paths = config.get('paths');

  var filtersPath = paths.filters || path.resolve(__dirname + '/../../../app/utils/filters');
  var helpersPath = paths.helpers || path.resolve(__dirname + '/../../../app/utils/helpers');

  this.loadFiles(filtersPath);
  this.loadFiles(helpersPath);
}

module.exports = function (url, page, json) {
  return new View(url, page, json);
};

module.exports.View = View;
