var _pages = {};

var Page = function (name, template, settings, datasources, events) {

  if (!template) throw new Error('Template required');

  this.name = name;
  this.template = template;

  this.settings = settings;
  this.datasources = datasources;
  this.events = events;

  _pages[name] = this;
};

// exports
module.exports = function (name, template, settings, datasources, events) {
  if (!template) throw new Error('Template required');
  if (name && template && settings) return new Page(name, template, settings, datasources, events);
  return _pages[name];
};

module.exports.Page = Page;
