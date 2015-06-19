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
var sendBackJSON = help.sendBackJSON;

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
  var i = 0;

  this.page.datasources.forEach(function(datasource) {
    var ds = new Datasource(self.page, datasource, self.options, function(ds) {
      self.datasources[ds.schema.datasource.key] = ds;
      i++;
      if (i == self.page.datasources.length) done();
    });
    
  });
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
    var debug = query.debug && query.debug.toString() === 'true';

    var done;

    if (debug) {
      done = sendBackJSON(200, res, next);
    }
    else {
      done = sendBackHTML(200, res, next);
    }
    
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

  var query = url.parse(req.url, true).query;
  
  // remove cache & debug from query
  delete query.cache;
  delete query.debug;

  var path = url.parse(req.url).pathname.replace('/','');

  // no datasources specified for this page
  if (typeof self.datasources === 'object' && Object.keys(self.datasources).length === 0) {
    // start processing the attached events
    if (0 !== Object.keys(self.events).length) {
      var eventIdx = 0;
      _.each(self.events, function(value, key) {
        
          self.events[key].run(req, res, function(result) {                
            data[key] = result;
          });

          eventIdx++;

          // return the data if we're at the end of the events
          // array, we have all the responses to render the page
          if (eventIdx === Object.keys(self.events).length) {
            done(data);
          }
      });
    }
    else {
      done(data);
    }
  }

  _.each(self.datasources, function(value, key) {

    var ds = self.datasources[key];

    var filter = {};

    if (key.indexOf(data.title) >= 0) {

      ds.schema.datasource.page = query.page || 1;
      delete query.page;
      
      filter = query;
      
      if (req.params.id || filter.id) {
        filter._id = req.params.id || filter.id;
        delete filter.id;
      }

      ds.schema.datasource.filter = {};

      _.each(filter, function(value, key) {
          ds.schema.datasource.filter[key] = value;
      });

      // rebuild datasource endpoint with filters
      var d = new Datasource();
      d.buildEndpoint(ds.schema, function(endpoint) {
        ds.endpoint = endpoint;
      });

    }

    help.getData(ds, function(result) {

      if (result) {
        data[key] = (typeof result === 'object' ? result : JSON.parse(result));
      }

      idx++;

      // if we're at the end of the datasources array, 
      // start processing the attached events
      if (idx === Object.keys(self.datasources).length) {


        if (0 !== Object.keys(self.events).length) {
          var eventIdx = 0;
          _.each(self.events, function(value, key) {
            
              self.events[key].run(req, res, function(result) {
                data[key] = result;
              });

              eventIdx++;

              // return the data if we're at the end of the events
              // array, we have all the responses to render the page
              if (eventIdx === Object.keys(self.events).length) {
                done(data);
              }
          });
        }
        else {
          done(data);
        }
      }
    });
  });
}

module.exports = function (page, options) {
  return new Controller(page, options);
};

module.exports.Controller = Controller;
