var _pages = {};

var Page = function (name, schema) {
  this.name = name;
  this.route = schema.route || '/' + name;
  this.template = schema.template || name + '.dust';

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
