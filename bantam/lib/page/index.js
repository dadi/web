var _pages = {};

var Page = function (name, template, settings, datasources, events) {
  this.name = name;
  this.template = template;

  this.settings = settings;
  this.datasources = datasources;
  this.events = events;

  _pages[name] = this;
};

// exports
module.exports = function (name, template, settings, datasources, events) {
  if (settings) return new Page(name, template, settings, datasources, events);
  return _pages[name];
};

module.exports.Page = Page;

function validationError(message) {
  var err = new Error(message || 'Model Validation Failed');
  err.statusCode = 400
  return err;
}