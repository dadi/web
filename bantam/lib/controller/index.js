var fs = require('fs');
var url = require('url');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var logger = require(__dirname + '/../log');

var Datasource = require(__dirname + '/../datasource');
var Event = require(__dirname + '/../event');

// helpers
var sendBackHTML = help.sendBackHTML;

var Controller = function (page, options) {
  if (!page) throw new Error('Page instance required');
  
  this.page = page;

  this.options = options || {};

  this.datasources = {};
  this.events = {};

  var self = this;

  this.attachDatasources(function() {
    //console.log(self.datasources);
  });

  this.attachEvents(function() {
    //console.log(self.events);
  });
};

Controller.prototype.attachDatasources = function(done) {    
  var self = this;

  this.page.datasources.forEach(function(datasource) {
    var ds = new Datasource(self.page, datasource, self.options);
    self.datasources[ds.schema.datasource.key] = ds;
  });

  done();
};

Controller.prototype.attachEvents = function(done) {
  var self = this;

  this.page.events.forEach(function(eventName) {
    var e = new Event(self.page.name, eventName, self.options);
    self.events[eventName] = e;
  });

  done();
};

Controller.prototype.get = function (req, res, next) {

    var settings = {};

    // allow query string param to return data only
    var query = url.parse(req.url, true).query;
    var debug = query.debug && query.debug.toString() === '1';

    var done = sendBackHTML(200, res, next);
    if (debug) done = sendBackJSON(200, res, next);
    
    self = this;

    var data = {
      "title": self.page.name
    }

    // add id component from the request
    if (req.params.id) data.id = decodeURIComponent(req.params.id);

    var template = _.find(_.keys(dust.cache), function (k){ return k.indexOf(self.page.name) > -1; });
    if (!template) {
      return sendBackHTML(500, res, next)(null, "Dust template not found");
    }

    self.loadData(req, res, data, function(data) {
      
      if (debug) {
        // Return the raw data
        done(null, data);
      }
      else {
        // Render the compiled template
        var rendered = dust.render(self.page.name, data, function(err, result) {
          if (err) done(err, null);
          done(err, result);
        });
      }
    })
};

Controller.prototype.loadData = function(req, res, data, done) {
  var idx = 0;
  var self = this;

  _.each(self.datasources, function(value, key) {

    var ds = self.datasources[key];

    help.getData(ds, function(result) {
      if (!result) return done();
      
      data[key] = (typeof result === 'object' ? result : JSON.parse(result));
      idx++;
      
      // if we're at the end of the datasources array, 
      // start processing the attached events
      if (idx === Object.keys(self.datasources).length) {

        idx = 0;
        _.each(self.events, function(value, key) {
          
            self.events[key].run(req, res, function(result) {
              data[key] = result;
            });

            idx++;

            // return the data if we're at the end of the events
            // array, we have all the responses to render the page
            if (idx === Object.keys(self.events).length) {
              done(data);
            }
        });

        done(data);
      }
    });
  });
};

module.exports = function (page, options) {
  return new Controller(page, options);
};

module.exports.Controller = Controller;
