var fs = require('fs');
var url = require('url');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var Q = require('q');
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
  
  if (!this.page.datasources) return;

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
  
  if (!this.page.events) return;

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

    // global values from config
    if (config.global) data.global = config.global; 

    // add id component from the request
    if (req.params.id) data.id = decodeURIComponent(req.params.id);

    var pageTemplate = self.page.template.slice(0, self.page.template.indexOf('.'));
    var template = _.find(_.keys(dust.cache), function (k){ return k.indexOf(pageTemplate) > -1; });
    
    if (!template) {
      return sendBackHTML(500, res, next)(null, "Dust template not found");
    }

    self.loadData(req, res, data, function(data) {
      if (debug) {
        // Return the raw data
        return done(null, data);
      }
      else {
        // Render the compiled template
        var rendered = dust.render(pageTemplate, data, function(err, result) {
          if (err) done(err, null);
          return done(err, result);
        });
      }
    })
};

function hasAttachedDatasources(datasources) {
  return (typeof datasources === 'object' && Object.keys(datasources).length > 0);
}

function loadEventData(events, req, res, data, done) {
  
  // return the global data object, no events to run
  if (0 === Object.keys(events).length) {
    return done(data);
  }

  var eventIdx = 0;
  
  _.each(events, function(value, key) {
      
      // run the event  
      events[key].run(req, res, data, function(result) {                
        
        // add the result to our global data object
        data[key] = result;

        eventIdx++;

        // return the data if we're at the end of the events
        // array, we have all the responses to render the page
        if (eventIdx === Object.keys(events).length) {
          return done(data);
        }
      });
  });
}

Controller.prototype.loadData = function(req, res, data, done) {
  var idx = 0;
  var self = this;

  var query = url.parse(req.url, true).query;
  
  // remove cache & debug from query
  delete query.cache;
  delete query.debug;

  var path = url.parse(req.url).pathname.replace('/','');

  // no datasources specified for this page
  // so start processing the attached events
  if (!hasAttachedDatasources(self.datasources)) {
    loadEventData(self.events, req, res, data, function(result) {
      return done(result);
    });
  }

  var primaryDatasources = {}, chainedDatasources = {};
  _.each(self.datasources, function (ds, key) {
    if (ds.chained) {
      chainedDatasources[key] = ds;
    }
    else {
      primaryDatasources[key] = ds;
    }
  });

  _.each(primaryDatasources, function(datasource, key) {

    processSearchParameters(key, datasource, req.params, query)
    .then(help.getData(datasource, function(result) {

        if (result) {
          data[key] = (typeof result === 'object' ? result : JSON.parse(result));
        }

        idx++;        

        if (idx === Object.keys(primaryDatasources).length) {
          processChained(chainedDatasources, data, function() {

            loadEventData(self.events, req, res, data, function(result) {
              done(result);
            });

          });
        }
      })
    );
  });
}

function processChained(chainedDatasources, data, done) {
  
  var idx = 0;

  if (0 === Object.keys(chainedDatasources).length) {
    return done(data);
  }

  _.each(chainedDatasources, function(chainedDatasource, chainedKey) {
    
    if (data[chainedDatasource.chained.datasource]) {

      // find the value of the parameter in the returned data
      // to use in the chained datasource
      var param = "";
      
      try {
        param = 
      chainedDatasource.chained.outputParam.param.split(".").reduce(function(o, x) { 
        return o ? o[x] : "" }, data[chainedDatasource.chained.datasource]);
      }
      catch(e) {
        param = e;
        logger.prod('Error processng chained datasource: ' + e);
        console.log('Error processng chained datasource: ' + e);
      }

      // add or extend the filter property
      chainedDatasource.schema.datasource.filter = chainedDatasource.schema.datasource.filter || {};

      // if there is a field to filter on, add the new parameter value to the filters
      if (chainedDatasource.chained.outputParam.field) {
        chainedDatasource.schema.datasource.filter[chainedDatasource.chained.outputParam.field] = encodeURIComponent(param);
      }

      // if the datasource specified a query, add it to the existing filter by looking for the placeholder value
      if (chainedDatasource.chained.outputParam.query) {
        var placeholder = "{" + chainedKey + "}";
        chainedDatasource.schema.datasource.filter.replace(placeholder, chainedDatasource.chained.outputParam.query);
      }

      console.log(chainedDatasource.schema.datasource.filter);

      // rebuild the datasource endpoint with the new filters
      var d = new Datasource();
      d.buildEndpoint(chainedDatasource.schema, function(endpoint) {
        chainedDatasource.endpoint = endpoint;

        help.getData(chainedDatasource, function(result) {

          if (result) {
            data[chainedKey] = (typeof result === 'object' ? result : JSON.parse(result));
          }

          idx++;

          if (idx === Object.keys(chainedDatasources).length) {
            done(data);
          }

        });

      });
    }
  });

}

function processSearchParameters(key, datasource, params, query) {

  var deferred = Q.defer();

  datasource.schema.datasource.filter = datasource.schema.datasource.filter || {};

  // add ID filter if the current datasource matches the page name
  if (key.indexOf(datasource.page.name) >= 0) {

    // remove page # from query
    datasource.schema.datasource.page = query.page || 1;
    delete query.page;
    
    // add an ID filter if it was present in the querystring
    // either as http://www.blah.com?id=xxx or via a route parameter e.g. /books/:id
    if (params.id || query.id) {
      datasource.schema.datasource.filter['_id'] = params.id || query.id;
      delete query.id;
    }

    // URI encode each filter value
    _.each(query, function(value, key) {
        if (key === 'filter') {
          _.extend(datasource.schema.datasource.filter, JSON.parse(value));
        }
        else {
          datasource.schema.datasource.filter[key] = encodeURIComponent(value);
        }
    });
  }
  
  // process each of the datasource's requestParams, testing for their existence
  // in the querystring's request params e.g. /car-reviews/:make/:model
  _.each(datasource.requestParams, function(obj) {
    if (params.hasOwnProperty(obj.param)) {
      datasource.schema.datasource.filter[obj.field] = encodeURIComponent(params[obj.param]);
    }
  });

  // rebuild the datasource endpoint with the new filters
  var d = new Datasource();
  d.buildEndpoint(datasource.schema, function(endpoint) {
    datasource.endpoint = endpoint;
    deferred.resolve();
  });

  return deferred.promise;
}

module.exports = function (page, options) {
  return new Controller(page, options);
};

module.exports.Controller = Controller;
