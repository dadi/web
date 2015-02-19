var fs = require('fs');

var config = require(__dirname + '/../../../config');
var logger = require(__dirname + '/../log');

var Event = function (pageName, eventName, options) {
  if (!pageName) throw new Error('Page name required');
  
  this.page = pageName;
  this.name = eventName;
  this.options = options || {};
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
  this.loadEvent(this.name)(req, res, function(result) {
    done(result);
  });
};

module.exports = function (page, eventName, options) {
  return new Event(page, eventName, options);
};

module.exports.Event = Event;
