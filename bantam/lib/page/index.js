var pathToRegexp = require('path-to-regexp');

var _pages = {};

var Page = function (name, schema) {

  if (schema.route && typeof schema.route != 'object') {
    var newSchema = schema;
    newSchema.route = { "paths": [schema.route] };
    var message = "\nThe `route` property for pages has been extended to provide better routing functionality.\n";
    message += "Please modify the route property for page '" + name + "'. The schema should change to the below:\n\n";
    message += JSON.stringify(newSchema, null, 4) + "\n\n";
    throw new Error(message);
  }

  this.name = name;

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
  }
  else {
    this.route = { "paths": ['/' + name] };
  }

  this.route.toPath = pathToRegexp.compile(this.route.paths[0]);
  this.template = schema.template || name + '.dust';
  this.contentType = schema.contentType || 'text/html';

  this.settings = schema.settings || {};
  this.datasources = schema.datasources;
  this.events = schema.events;

  this.beautify = this.settings.hasOwnProperty('beautify') ? this.settings.beautify : true;
  this.keepWhitespace = this.settings.hasOwnProperty('keepWhitespace') ? this.settings.keepWhitespace : false;

  _pages[name] = this;
};

// exports
module.exports = function (name, schema) {
  if (name && schema) return new Page(name, schema);
  return _pages[name];
};

module.exports.Page = Page;
