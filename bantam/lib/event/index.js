var fs = require('fs');
var http = require('http');
var url = require('url');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var logger = require(__dirname + '/../log');

// helpers
var sendBackJSON = help.sendBackJSON;
var sendBackJSONP = help.sendBackJSONP;
var sendBackHTML = help.sendBackHTML;
var parseQuery = help.parseQuery;

var Event = function (pageName, eventName, options) {
  //if (!page) throw new Error('Page instance required');
  
  this.page = pageName;
  this.name = eventName;

  this.options = options || {};

  this.eventFn = this.loadEvent(this.name);
};

Event.prototype.loadEvent = function(eventName) {

  var filepath = this.options.eventPath + "/" + eventName + ".js";

  if (filepath && !fs.existsSync(filepath)) {
    throw new Error('Page "' + this.page + '" references event "' + eventName + '" which can\'t be found in "' + this.options.eventPath + '"');
  }
  
  try {
    // get the event
    return require(filepath);  
  }
  catch (err) {
    throw new Error('Error loading event "' + filepath + '". ' + err);
  }
};

Event.prototype.run = function(req, res, done) {
  var self = this;
  this.eventFn(req, res, function(result) {
    done(result);
  });
};

module.exports = function (page, eventName, options) {
  return new Event(page, eventName, options);
};

module.exports.Event = Event;
