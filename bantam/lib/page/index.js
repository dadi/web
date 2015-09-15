var _pages = {};

var Page = function (name, schema) {

  if (schema.route && typeof schema.route != 'object') {
    var newSchema = schema;
    newSchema.route = { "path": schema.route };
    var message = "\nThe `route` property for pages has been extended to provide better routing functionality.\n";
    message += "Please modify the route property for page '" + name + "'. The schema should change to the below:\n\n";
    message += JSON.stringify(newSchema, null, 4) + "\n\n";
    throw new Error(message);
  }

  this.name = name;
  this.route = schema.route || { "path": '/' + name };
  this.template = schema.template || name + '.dust';
  this.contentType = schema.contentType || 'text/html';

  this.settings = schema.settings;
  this.datasources = schema.datasources;
  this.events = schema.events;

  _pages[name] = this;
};

// exports
module.exports = function (name, schema) {
  if (name && schema) return new Page(name, schema);
  return _pages[name];
};

module.exports.Page = Page;
