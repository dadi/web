/**
 * @module Controller
 */
var async = require('async');
var fs = require('fs');
var url = require('url');
var Q = require('q');
var crypto = require('crypto');
var beautify_html = require('js-beautify').html;
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');

var Datasource = require(__dirname + '/../datasource');
var Event = require(__dirname + '/../event');
var View = require(__dirname + '/../view');

// helpers
var sendBackHTML = help.sendBackHTML;
var sendBackJSON = help.sendBackJSON;

var Controller = function (page, options, meta) {
  if (!page) throw new Error('Page instance required');

  this.page = page;

  this.options = options || {};
  this.meta = meta || {};

  this.datasources = {};
  this.events = [];
  this.preloadEvents = [];

  var self = this;

  this.attachDatasources(function(err) {
    if (err) {
      log.error({module: 'controller'}, err);
      throw err;
    }
  });

  this.attachEvents(function() {
    //console.log(self.events);
  });
};

Controller.prototype.attachDatasources = function(done) {
  var self = this;
  var i = 0;

  /* DEBUG */
  console.log('| self.page:'.green, JSON.stringify(self.page))
  console.log('| datasources:'.green, this.page.datasources)
  //console.log('| self.options:'.green, self.options)

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
  var self = this;

  // add global events first
  config.get('globalEvents').forEach(function(eventName) {
    var e = new Event(self.page.name, eventName, self.options);
    self.preloadEvents.push(e);
  });

  this.page.preloadEvents.forEach(function(eventName) {
    var e = new Event(self.page.name, eventName, self.options);
    self.preloadEvents.push(e);
  });

  this.page.events.forEach(function(eventName) {
    var e = new Event(self.page.name, eventName, self.options);
    self.events.push(e);
  });

  done();
};

Controller.prototype.requiredDataPresent = function (data) {
  if (_.isEmpty(this.page.requiredDatasources)) return true;
  return _.every(this.page.requiredDatasources, function (datasource) {
    return data.hasOwnProperty(datasource) && data[datasource].hasOwnProperty('results') && data[datasource].results.length !== 0;
  });
}

Controller.prototype.buildInitialViewData = function(req) {

  var data = {};
  var urlData = url.parse(req.url, true);

  data.query = urlData.query;
  data.params = {};
  data.pathname = "";
  data.host = req.headers.host;
  data.page = this.meta;

  if (urlData.pathname.length) data.pathname = urlData.pathname;

  // add request params (params from the path, e.g. /:make/:model)
  _.extend(data.params, req.params);

  // add query params (params from the querystring, e.g. /reviews?page=2);
  _.extend(data.params, data.query);

  if (req.error) data.error = req.error;

  // add id component from the request
  if (req.params.id) data.id = decodeURIComponent(req.params.id);

  // allow JSON view using ?json=true
  var json = config.get('allowJsonView') && urlData.query.json && urlData.query.json.toString() === 'true';

  data.title = this.page.name;
  data.global = config.has('global') ? config.get('global') : {};  // global values from config
  data.debug = config.get('debug');
  data.json = json || false;

  delete data.query.json;
  delete data.params.json;

  return data;
}

Controller.prototype.post = function (req, res, next) {
  return this.process(req, res, next);
}

Controller.prototype.get = function (req, res, next) {
  return this.process(req, res, next);
}

Controller.prototype.process = function (req, res, next) {
    help.timer.start(req.method.toLowerCase());

    log.debug({module: 'controller'}, {req:req});

    /* DEBUG */
    console.log('Controller.prototype.process:'.green, req.url)

    var self = this;
    var settings = {};
    var done;

    var statusCode = res.statusCode || 200;

    var data = this.buildInitialViewData(req);
    var view = new View(req.url, self.page, data.json);

    if (data.json) {
      done = sendBackJSON(statusCode, res, next);
    }
    else {
      done = sendBackHTML(req.method, statusCode, this.page.contentType, res, next);
    }

    /* DEBUG */
    console.log('* self.loadData()'.green)

    self.loadData(req, res, data, function(err, data, dsResponse) {

      // return 404 if requiredDatasources contain no data
      if (!self.requiredDataPresent(data)) {
        return next();
      }

      if (err) {
        if (err.statusCode && err.statusCode === 404) return next();
        return done(err);
      }

      // If we received a response back from the datasource, and
      // not just the data, send the whole response back
      if (dsResponse) {
        if (dsResponse.statusCode === 202) {
          done = sendBackJSON(dsResponse.statusCode, res, next);
          return done(null, data);
        }
      }

      help.timer.stop(req.method.toLowerCase());
      if (data) data.stats = help.timer.getStats();

      if (data.json) {
        return done(null, data);
      }

      view.setData(data);

      view.render(function(err, result) {
        if (err) return next(err);
        return done(null, result);
      });
    });
}

function hasAttachedDatasources(datasources) {
  return (typeof datasources === 'object' && Object.keys(datasources).length > 0);
}

Controller.prototype.loadEventData = function (events, req, res, data, done) {
  // return the global data object, no events to run
  if (0 === Object.keys(events).length) {
    return done(null, data);
  }

  var eventIdx = 0;

  _.each(events, function(event) {
      help.timer.start('event: ' + event.name);

      // add a random value to the data obj so we can check if an
      // event has sent back the obj - in which case we assign it back
      // to itself
      var checkValue = crypto.createHash('md5').update(new Date().toString()).digest("hex");
      data.checkValue = checkValue;

      // run the event
      try {
        event.run(req, res, data, function (err, result) {
          help.timer.stop('event: ' + event.name);

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
            data[event.name] = result;
          }

          eventIdx++;

          // return the data if we're at the end of the events
          // array, we have all the responses to render the page
          if (eventIdx === events.length) {
            return done(null, data);
          }
        });
      }
      catch (err) {
        return done(err, data);
      }
  });
}

Controller.prototype.loadData = function(req, res, data, done) {
  var idx = 0;
  var self = this;

  var primaryDatasources = {}
  var chainedDatasources = {};
  _.each(self.datasources, function (ds, key) {
    if (ds.chained) {
      chainedDatasources[key] = ds;
    }
    else {
      primaryDatasources[key] = ds;
    }
  });

  /* DEBUG */
  console.log('* primaryDatasources:'.green, primaryDatasources)
  console.log('* chainedDatasources:'.green, chainedDatasources)

  help.timer.start('load data');

  async.waterfall([
    // Run PreLoad Events
    function(callback) {
      help.timer.start('preload data');
      self.loadEventData(self.preloadEvents, req, res, data, function (err, result) {
        if (err) return done(err);
        help.timer.stop('preload data');
        callback(null);
      })
    },

    // Run datasources
    function(callback) {
      if (!hasAttachedDatasources(self.datasources)) {
        callback(null);
      }

      var queue = async.queue(function(ds, cb) {

        /* DEBUG */
        console.log('. Controller.prototype.loadData:'.green, ds.name)

        if (ds.filterEvent) {
          ds.filterEvent.run(req, res, data, function(err, filter) {
            if (err) return done(err);
            ds.schema.datasource.filterEventResult = filter;
          })
        }

        processSearchParameters(ds.schema.datasource.key, ds, req);

        help.timer.start('datasource: ' + ds.name);

        /* DEBUG */
        ds.provider.load(req.url, function(err, result, dsResponse) {
          help.timer.stop('datasource: ' + ds.name);
          if (err) return done(err);

          if (dsResponse) {
            return done(null, result, dsResponse);
          }

          if (result) {
            try {
              data[ds.schema.datasource.key] = (typeof result === 'object' ? result : JSON.parse(result));
            }
            catch (e) {
              console.log(e);
            }
          }

          cb()
        })
      }, 1)

      // queue finished
      queue.drain = function() {
        callback(null);
      };

      // add each primary datasource to the queue for processing
      _.each(primaryDatasources, function(datasource) {
        queue.push(datasource)
      })
    },

    // Run chained datasources
    function(callback) {
      self.processChained(chainedDatasources, data, req, function(err, result) {
        if (err) return done(err);
        callback(null);
      })
    },

    // Run events
    function(callback) {
      self.loadEventData(self.events, req, res, data, function (err, result) {
        if (err) return done(err);
        callback(null);
      });
    }
  ],

  // final results
  function (err) {
    help.timer.stop('load data');
    done(err, data);
  })
}

Controller.prototype.processChained = function (chainedDatasources, data, req, done) {

  var idx = 0;
  var self = this;

  if (0 === Object.keys(chainedDatasources).length) {
    return done(null, data);
  }

  _.each(chainedDatasources, function(chainedDatasource, chainedKey) {

    help.timer.start('datasource: ' + chainedDatasource.name + ' (chained)');

    if (!data[chainedDatasource.chained.datasource]) {
      var message = "Chained datasource '" + chainedDatasource.name + "' expected to find data from datasource '" + chainedDatasource.chained.datasource + "'.";
      var err = new Error();
      err.message = message;
      log.warn({module: 'controller'}, message);
      return done(err);
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
      return done(e);
    }

    // cast the param value if needed
    if (chainedDatasource.chained.outputParam.type && chainedDatasource.chained.outputParam.type === 'Number') {
      param = parseInt(param);
    }
    else {
      param = encodeURIComponent(param);
    }

    // does the parent page require no cache?
    if (data.query.cache === 'false') {
      chainedDatasource.schema.datasource.cache = false;
    }

    // add page # to datasource options
    chainedDatasource.schema.datasource.page = data.query.page || 1;

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

    chainedDatasource.provider.buildEndpoint(chainedDatasource.schema, function() {});
    chainedDatasource.provider.loadData(req.url, function(err, result) {

      help.timer.stop('datasource: ' + chainedDatasource.name + ' (chained)');

      if (result) {
        try {
          data[chainedKey] = (typeof result === 'object' ? result : JSON.parse(result));
        }
        catch (e) {
          log.error({module: 'controller'}, e);
        }
      }

      idx++;

      if (idx === Object.keys(chainedDatasources).length) {
        return done(null, data);
      }

    });
  });
}

function processSearchParameters(key, datasource, req) {
  // process each of the datasource's requestParams, testing for their existence
  // in the querystring's request params e.g. /car-reviews/:make/:model
  datasource.processRequest(key, req);
}

module.exports = function (page, options, meta) {
  return new Controller(page, options, meta);
};

module.exports.Controller = Controller;
