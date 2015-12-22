var pathToRegexp = require('path-to-regexp');
var config = require(__dirname + '/../../../config');

var _pages = {};

var Page = function (name, schema) {

  schema.settings = schema.settings || {};

  this.name = name; //schema.page.name || name;
  this.key = schema.page.key || name;
  this.template = schema.template || name + '.dust';
  this.contentType = schema.contentType || 'text/html';
  this.datasources = schema.datasources;
  this.events = schema.events;

  this.settings = schema.settings;
  this.beautify = this.settings.hasOwnProperty('beautify') ? this.settings.beautify : false;
  this.keepWhitespace = getWhitespaceSetting(this.settings);
  this.passFilters =  this.settings.hasOwnProperty('passFilters') ? this.settings.passFilters : false;

  // throw error if route property is invalid
  if (schema.route && typeof schema.route != 'object') {
    var newSchema = schema;
    newSchema.route = { "paths": [schema.route] };
    var message = "\nThe `route` property for pages has been extended to provide better routing functionality.\n";
    message += "Please modify the route property for page '" + name + "'. The schema should change to the below:\n\n";
    message += JSON.stringify(newSchema, null, 4) + "\n\n";
    throw new Error(message);
  }

  // rewrite the route property if required
  if (schema.route) {
    if (schema.route.path && typeof schema.route.path === 'string') {
      this.route = { "paths": [schema.route.path] };
      if (schema.route.constraint) this.route.constraint = schema.route.constraint;
    }
    else if (schema.route.paths && typeof schema.route.paths === 'string') {
      this.route = { "paths": [schema.route.paths] };
      if (schema.route.constraint) this.route.constraint = schema.route.constraint;
    }
    else {
      this.route = schema.route;
    }
    schema.route = this.route;
  }
  else {
    this.route = { "paths": ['/' + name] };
  }

  // throw error if cache property is invalid
  if (schema.page.cache) {
    schema.settings.cache = schema.page.cache;
    delete schema.page.cache;

    var message = "\nThe `cache` property should be nested under `settings`.\n";
    message += "Please modify the descriptor file for page '" + name + "'. The schema should change to the below:\n\n";
    message += JSON.stringify(schema, null, 4) + "\n\n";

    throw new Error(message);
  }

  _pages[name] = this;
};

Page.prototype.toPath = function (params) {

  var error, url;

  this.route.paths.forEach(function (path) {

      try {
        url = pathToRegexp.compile(path)(params);
        error = null;
      }
      catch (err) {
        error = err;
      }

  });

  if (!url && error) throw error;

  return url;
}

function getWhitespaceSetting(settings) {
  var dustConfig = config.get('dust');
  var whitespace = true;

  if (dustConfig && dustConfig.hasOwnProperty('whitespace')) {
    whitespace = dustConfig.whitespace;
  }

  if (settings.hasOwnProperty('keepWhitespace')) {
    whitespace = settings.keepWhitespace;
  }

  return whitespace;
}

// exports
module.exports = function (name, schema) {
  if (name && schema) return new Page(name, schema);
  return _pages[name];
};

module.exports.Page = Page;
