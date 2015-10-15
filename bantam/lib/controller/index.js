var fs = require('fs');
var url = require('url');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var commonDustHelpers = require('common-dustjs-helpers');
var Q = require('q');
var crypto = require('crypto');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
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

  this.attachDatasources(function(err) {
    //console.log(self.datasources);
    if (err) {
      console.log(err);
    }
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
    var ds = new Datasource(self.page, datasource, self.options, function(err, ds) {
      if (err) {
        return done(err);
      }
      self.datasources[ds.schema.datasource.key] = ds;
      i++;
      if (i == self.page.datasources.length) done(null);
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
    var json = query.json && query.json.toString() === 'true';

    var statusCode = res.statusCode || 200;

    var statusCode = res.statusCode || 200;
    var done;

    if (json) {
      done = sendBackJSON(statusCode, res, next);
    }
    else {
      done = sendBackHTML(statusCode, this.page.contentType, res, next);
    }
    
    var self = this;

    var data = {
      "title": self.page.name,
      "debug": debug || false,
      "json": json || false
    }

    // global values from config
    if (config.has('global')) data.global = config.get('global'); 

    // add id component from the request
    if (req.params.id) data.id = decodeURIComponent(req.params.id);

    // add common dust helpers
    new commonDustHelpers.CommonDustjsHelpers().export_helpers_to(dust);
    
    var pageTemplate = self.page.template.slice(0, self.page.template.indexOf('.'));
    var template = _.find(_.keys(dust.cache), function (k){ return k.indexOf(pageTemplate) > -1; });

    if (!template) {
      var err = new Error();
      err.json = { "message": "Dust template not found" };
      err.statusCode = 500;
      return next(err);
    }

    self.loadData(req, res, data, function(err, data) {
      if (err) {
        var e = new Error(err.json.message);
        e.statusCode = err.statusCode;
        if (next) return next(e);
      }

      try {
        if (json) {
          // Return the raw data
          return done(null, data);
        }
        else {
          // Render the compiled template
          var rendered = dust.render(pageTemplate, data, function(err, result) {
            if (err) {
              err = new Error();
              err.json = { "error": "Template rendering failed." };
              err.statusCode = 500;
              return done(err, null);
            }

            return done(err, result);
          });
        }
      }
      catch (e) {
        console.log(e);
        var err = new Error(e.message);
        err.statusCode = 500;
        return next(err);
      }
    });
};

function hasAttachedDatasources(datasources) {
  return (typeof datasources === 'object' && Object.keys(datasources).length > 0);
}

function loadEventData(events, req, res, data, done) {
  
  // return the global data object, no events to run
  if (0 === Object.keys(events).length) {
    return done(null, data);
  }

  var eventIdx = 0;
  
  _.each(events, function(value, key) {

      // add a random value to the data obj so we can check if an
      // event has sent back the obj - in which case we assign it back
      // to itself
      var checkValue = crypto.createHash('md5').update(new Date().toString()).digest("hex");
      data.checkValue = checkValue;
      
      // run the event  
      events[key].run(req, res, data, function (err, result) {

        if (err) {
          return done(err, data);
        }
        
        // if we get data back with the same checkValue property,
        // reassign it to our global data object to avoid circular JSON
        if (result && result.checkValue && result.checkValue === checkValue) {
          data = result;
        }
        else if (result) {
          // add the result to our global data object
          data[key] = result;
        }

        eventIdx++;

        // return the data if we're at the end of the events
        // array, we have all the responses to render the page
        if (eventIdx === Object.keys(events).length) {
          return done(null, data);
        }
      });
  });
}

Controller.prototype.loadData = function(req, res, data, done) {  
  var idx = 0;
  var self = this;

  var query = url.parse(req.url, true).query;
  
  // remove debug from query
  delete query.debug;
  delete query.json;

  var path = url.parse(req.url).pathname.replace('/','');

  // no datasources specified for this page
  // so start processing the attached events
  if (!hasAttachedDatasources(self.datasources)) {
    loadEventData(self.events, req, res, data, function (err, result) {
      return done(err, result);
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
    .then(help.getData(datasource, function(err, result) {
        
        if (err) return done(err);

        if (result) {
          try {
            data[key] = (typeof result === 'object' ? result : JSON.parse(result));
          }
          catch (e) {
            console.log(e);
          }
        }

        idx++;        

        if (idx === Object.keys(primaryDatasources).length) {
          processChained(chainedDatasources, data, query, function() {

            loadEventData(self.events, req, res, data, function (err, result) {
              done(err, result);
            });

          });
        }
      })
    );
  });
}

function processChained(chainedDatasources, data, query, done) {
  
  var idx = 0;

  if (0 === Object.keys(chainedDatasources).length) {
    return done(data);
  }

  _.each(chainedDatasources, function(chainedDatasource, chainedKey) {
    
    if (!data[chainedDatasource.chained.datasource]) {
      data[chainedDatasource.chained.datasource] = "Error: chained datasource " + chainedKey + " expected data at this node.";
      return done(data);
    }

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

    if (query.cache === 'false') {
      chainedDatasource.schema.datasource.cache = false;
    }

    // add page # to filter
    chainedDatasource.schema.datasource.page = query.page || 1;

    // if there is a field to filter on, add the new parameter value to the filters
    if (chainedDatasource.chained.outputParam.field) {
      if (chainedDatasource.chained.outputParam.type && chainedDatasource.chained.outputParam.type === 'Number') {
        param = parseInt(param);
      }
      else {
        param = encodeURIComponent(param);
      }

      chainedDatasource.schema.datasource.filter[chainedDatasource.chained.outputParam.field] = param;
    }

    // if the datasource specified a query, add it to the existing filter 
    // by looking for the placeholder value
    if (chainedDatasource.chained.outputParam.query) {
      var placeholder = '"{' + chainedDatasource.chained.datasource + '}"';
      var filter = JSON.stringify(chainedDatasource.schema.datasource.filter);
      var q = JSON.stringify(chainedDatasource.chained.outputParam.query);

      q = q.replace("{param}", encodeURIComponent(param));
      filter = filter.replace(placeholder, q);

      chainedDatasource.schema.datasource.filter = JSON.parse(filter);
    }

    // rebuild the datasource endpoint with the new filters
    var d = new Datasource();
    d.buildEndpoint(chainedDatasource.schema, function(endpoint) {

      chainedDatasource.endpoint = endpoint;

      help.getData(chainedDatasource, function(err, result) {

        if (result) {
          try {
            data[chainedKey] = (typeof result === 'object' ? result : JSON.parse(result));
          }
          catch (e) {
            console.log(e);
          }
        }

        idx++;

        if (idx === Object.keys(chainedDatasources).length) {
          return done(data);
        }

      });

    });
  });

}

function processSearchParameters(key, datasource, params, query) {

  var deferred = Q.defer();

  var queryOptions = _.clone(query);
  if (queryOptions.cache === 'false') {
    // remove cache from query
    delete queryOptions.cache;
    datasource.schema.datasource.cache = false;
  }

  datasource.schema.datasource.filter = datasource.schema.datasource.filter || {};

  // add ID filter if the current datasource matches the page name
  if (key.indexOf(datasource.page.name) >= 0) {
    
    // remove page # from query
    datasource.schema.datasource.page = queryOptions.page || params.page || 1;
    delete queryOptions.page;
    delete params.page;
    
    // add an ID filter if it was present in the querystring
    // either as http://www.blah.com?id=xxx or via a route parameter e.g. /books/:id
    if (params.id || queryOptions.id) {
      datasource.schema.datasource.filter['_id'] = params.id || queryOptions.id;
      delete queryOptions.id;
    }

    // URI encode each filter value
    _.each(queryOptions, function(value, key) {
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
    else {
      // param not found in request, remove it from DS filter
      if (datasource.schema.datasource.filter[obj.field]) {
        delete datasource.schema.datasource.filter[obj.field];
      }
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
