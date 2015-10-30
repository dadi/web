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
var log = require(__dirname + '/../log');

var Datasource = require(__dirname + '/../datasource');
var Event = require(__dirname + '/../event');

// helpers
var sendBackHTML = help.sendBackHTML;
var sendBackJSON = help.sendBackJSON;

var Controller = function (page, options) {
  if (!page) throw new Error('Page instance required');

  this.log = log.get().child({module: 'controller'});
  this.log.info('Controller logging started (' + (page.name || '') + ').');

  this.page = page;

  this.options = options || {};

  this.datasources = {};
  this.events = {};

  var self = this;

  this.attachDatasources(function(err) {
    if (err) {
      self.log.error(err);
      throw err;
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

// Controller.prototype.post = function (req, res, next) {
//   sendBackHTML(200, this.page.contentType, res, next)(null, "\n\nPOST Return\n\n");
// }

Controller.prototype.get = function (req, res, next) {

    this.log.debug({req:req});

    var settings = {};

    // allow query string param to return data only
    var query = url.parse(req.url, true).query;
    var debug = config.get('debug');
    var json = config.get('allowJsonView') && query.json && query.json.toString() === 'true';

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
      "json": json || false,
      "global": config.get('global') || {}  // global values from config
    }

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
        var e = new Error(err.json? err.json.message : err);
        e.statusCode = err.statusCode || 500;
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
              err = new Error(err.message);
              err.statusCode = 500;
              return done(err, null);
            }

            return done(err, result);
          });
        }
      }
      catch (e) {
        var err = new Error(e.message);
        err.statusCode = 500;
        if (next) {
          return next(err);
        }
        else {
          return done(err);
        }
      }
    });
};

function hasAttachedDatasources(datasources) {
  return (typeof datasources === 'object' && Object.keys(datasources).length > 0);
}

Controller.prototype.loadEventData = function (events, req, res, data, done) {

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

  // no datasources specified for this page
  // so start processing the attached events
  if (!hasAttachedDatasources(self.datasources)) {
    self.loadEventData(self.events, req, res, data, function (err, result) {
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

    processSearchParameters(key, datasource, req);

    help.getData(datasource, function(err, result) {

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
        self.processChained(chainedDatasources, data, query, function() {

          self.loadEventData(self.events, req, res, data, function (err, result) {
            done(err, result);
          });

        });
      }
    })

  });
}

Controller.prototype.processChained = function (chainedDatasources, data, query, done) {

  var idx = 0;
  var self = this;

  if (0 === Object.keys(chainedDatasources).length) {
    return done(data);
  }

  _.each(chainedDatasources, function(chainedDatasource, chainedKey) {

    if (!data[chainedDatasource.chained.datasource]) {
      var message = "Error: chained datasource " + chainedKey + " expected data at this node."
      data[chainedDatasource.chained.datasource] = message;
      self.log.warn(message);
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
      this.log.error('Error processing chained datasource: ' + e);
    }

    // cast the param value if needed
    if (chainedDatasource.chained.outputParam.type && chainedDatasource.chained.outputParam.type === 'Number') {
      param = parseInt(param);
    }
    else {
      param = encodeURIComponent(param);
    }

    // does the parent page require no cache?
    if (query.cache === 'false') {
      chainedDatasource.schema.datasource.cache = false;
    }

    // add page # to datasource options
    chainedDatasource.schema.datasource.page = query.page || 1;

    if (chainedDatasource.chained.outputParam.type && chainedDatasource.chained.outputParam.type === 'Number') {
      param = parseInt(param);
    }
    else {
      param = encodeURIComponent(param);
    }

    // if there is a field to filter on, add the new parameter value to the filters
    if (chainedDatasource.chained.outputParam.field) {
      chainedDatasource.schema.datasource.filter[chainedDatasource.chained.outputParam.field] = param;
    }

    // if the datasource specified a query, add it to the existing filter
    // by looking for the placeholder value
    if (chainedDatasource.chained.outputParam.query) {
      var placeholder = '"{' + chainedDatasource.chained.datasource + '}"';
      var filter = JSON.stringify(chainedDatasource.schema.datasource.filter);
      var q = JSON.stringify(chainedDatasource.chained.outputParam.query);

      if (typeof(param) != "number") {
        param = '"' + param + '"';
      }

      q = q.replace(/"\{param\}"/i, param);

      filter = filter.replace(placeholder, q);

      chainedDatasource.schema.datasource.filter = JSON.parse(filter);
    }

    chainedDatasource.buildEndpoint(chainedDatasource.schema, function() {});

    // rebuild the datasource endpoint with the new filters
    //var d = new Datasource();
    // d.buildEndpoint(chainedDatasource.schema, function(endpoint) {

    //   chainedDatasource.endpoint = endpoint;

    help.getData(chainedDatasource, function(err, result) {

      if (result) {
        try {
          data[chainedKey] = (typeof result === 'object' ? result : JSON.parse(result));
        }
        catch (e) {
          this.log.error(e);
        }
      }

      idx++;

      if (idx === Object.keys(chainedDatasources).length) {
        return done(data);
      }

    });

    //});
  });

}

function processSearchParameters(key, datasource, req) {

  // process each of the datasource's requestParams, testing for their existence
  // in the querystring's request params e.g. /car-reviews/:make/:model
  datasource.processRequest(key, req);
}

module.exports = function (page, options) {
  return new Controller(page, options);
};

module.exports.Controller = Controller;
