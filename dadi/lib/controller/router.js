/*
REWRITE INFO:
https://github.com/tinganho/connect-modrewrite
*/
var es = require('event-stream');
var fs = require('fs');
var path = require('path');
var url = require('url');
var querystring = require('querystring');
//var modRewrite = require('connect-modrewrite');
var toobusy = require('toobusy-js');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var log = require('@dadi/logger');
var rewrite = require(__dirname + '/rewrite');

var Datasource = require(__dirname + '/../datasource');

var rewriteFunction = null;

var Router = function (server, options) {

  log.info({module: 'router'}, 'Router logging started.')

  this.data = {};
  this.params = {};
  this.constraints = {};
  this.options = options;
  this.handlers = [];
  this.rules = [];

  this.rewritesFile = config.get('rewrites.path') === '' ? null : path.resolve(config.get('rewrites.path'));
  this.rewritesDatasource = config.get('rewrites.datasource');
  this.loadDatasourceAsFile = config.get('rewrites.loadDatasourceAsFile');

  this.server = server;

  // set latency values
  if (config.get('toobusy.enabled')) {
    toobusy.maxLag(config.get('toobusy.maxLag'));
    toobusy.interval(config.get('toobusy.interval'));
  }

  var self = this;

  // load the route constraint specifications if they exist
  try {
    delete require.cache[options.routesPath + '/constraints.js'];
    this.handlers = require(options.routesPath + '/constraints.js');
  }
  catch (err) {
    log.info({module: 'router'}, 'No route constraints loaded, file not found (' + options.routesPath + '/constraints.js' + ')');
  }
}

Router.prototype.loadRewrites = function(options, done) {

  var self = this;
  self.rules = [];

  if (self.rewritesDatasource && self.loadDatasourceAsFile) {
    // Get the rewritesDatasource
    var DadiAPI = require('@dadi/api-wrapper')
    var datasource = new Datasource(self.rewritesDatasource, self.rewritesDatasource, this.options, function(err, ds) {
      if (err) {
        log.error({module: 'router'}, err)
      }

      // var endpointParts = ds.source.endpoint.split('/')
      //
      // var api = new DadiAPI({
      //   uri: config.get('api.protocol') + '://' + config.get('api.host'),
      //   port: config.get('api.port'),
      //   credentials: {
      //     clientId: config.get('auth.clientId'),
      //     secret: config.get('auth.secret')
      //   },
      //   version: endpointParts[0],
      //   database: endpointParts[1]
      // })

      function refreshRewrites (cb) {
        // Get redirects from API collection
        var fresh_rules = [];
        var dataHelper = new help.DataHelper(ds, null);
        dataHelper.load(function(err, response) {
          if (err) {
            console.log('Error loading data in Router Rewrite module');
            console.log(err)
            return cb(null)
          }

          if (response) {
            response = JSON.parse(response)
          }

          if (response.results) {
            //api.in(self.rewritesDatasource).find().then(function (response)
            var idx = 0;

            _.each(response.results, function(rule) {
              fresh_rules.push(rule.rule + ' ' + rule.replacement + ' ' + '[R=' + rule.redirectType + ',L]');
              idx++;
              if (idx === response.results.length) {
                self.rules = fresh_rules;
                log.info('Loaded ' + idx + ' rewrites')
                if (rewriteFunction) rewriteFunction = rewrite(self.rules);
                if (cb) return cb(null);
              }
            });
          }
          else {
            if (cb) return cb(null);
          }
        });
      }

      setInterval(refreshRewrites, config.get('rewrites.datasourceRefreshTime') * 60 * 1000);
      refreshRewrites(done);

    });
  } else if (self.rewritesFile) {
    var rules = [];
    var stream = fs.createReadStream(self.rewritesFile, {encoding: 'utf8'});

    stream.pipe(es.split("\n"))
      .pipe(es.mapSync(function (data) {
        if (data !== "") rules.push(data);
      })
    );

    stream.on('error', function (err) {
      log.error({module: 'router'}, 'No rewrites loaded, file not found (' + self.rewritesFile + ')');
      done(err);
    });

    stream.on('end', function() {
      self.rules = rules.slice(0);
      done(null);
    });
  } else {
    done(null);
  }
}

/**
 *  Attaches a function from /{routesPath}/constraints.js or a datasource to the specified route
 *  @param {String} route
 *  @param {String} fn
 *  @return undefined
 *  @api public
 */
Router.prototype.constrain = function(route, constraint) {

  var self = this;
  var c;
  var message;

  if (this.handlers[constraint]) {

    // add constraint from /{routesPath}/constraints.js if it exists
    c = this.handlers[constraint];
    message = "Added route constraint function '%s' for '%s'";
  }
  else {

    // try to build a datasource from the provided constraint
    var datasource = new Datasource(route, constraint, this.options, function(err, ds) {
      if (err) {
        log.error({module: 'router'}, err);
      }

      c = ds;
      message = "Added route constraint datasource '%s' for '%s'";
    });
  }

  if (c) {
    this.constraints[route] = c;
    log.info({module: 'router'}, message, constraint, route);
  }
  else {
    var error = "Route constraint '" + constraint + "' not found. Is it defined in '" + this.options.routesPath + "/constraints.js' or '" + this.options.datasourcePath + "/" + constraint + ".json'?";
    var err = new Error(error);
    err.name = 'Router';
    log.error({module: 'router'}, error);
    throw(err);
  }

  return;
}

/**
 *  Attaches a function from /{routesPath}/constraints.js to the specified route
 *  @param {String} route
 *  @return `true` if `route` can be handled by a route handler, or if no handler matches the route. `false`
 *  if a route handler matches but returned false when tested.
 *  @api public
 */
Router.prototype.testConstraint = function(route, req, res, callback) {

  var self = this;

  if (!this.constraints[route]) {
    // no constraint against this route,
    // let's use it
    return callback(true);
  }

  // if there's a constraint handler
  // for this route, run it
  if (this.constraints[route]) {

    log.debug({module: 'router'}, "[ROUTER] testConstraint: " + req.url);
    log.debug({module: 'router'}, "[ROUTER] testConstraint: " + route);

    if (typeof this.constraints[route] === 'function') {

      help.timer.start('router constraint: ' + route);

      this.constraints[route](req, res, function (result) {
        help.timer.stop('router constraint: ' + route);

        // return the result
        return callback(result);
      });
    }
    else {
      // datasource
      var datasource = this.constraints[route];

      help.timer.start('router constraint: ' + datasource);

      datasource.processRequest(datasource.page.name, req);

      var dataHelper = new help.DataHelper(datasource, req.url);
      dataHelper.load(function(err, result) {

        help.timer.stop('router constraint: ' + datasource);

        if (err) {
          return callback(err);
        }

        if (result) {
          try {
            var results = JSON.parse(result);

            if (results && results.results && results.results.length > 0) {
              return callback(true);
            }
            else {
              return callback(false);
            }
          }
          catch (err) {
            log.error({module: 'router'}, err);
            return callback(false);
          }
        }
      });
    }
  }
}

Router.prototype.loadRewriteModule = function() {
  log.info({module: 'router'}, "Rewrite module reload.");
  log.info({module: 'router'}, this.rules.length + " rewrites/redirects loaded.");
}

module.exports = function (server, options) {

  var self = this;

  server.app.Router = new Router(server, options);

  // middleware which blocks requests when we're too busy
	server.app.use(function (req, res, next) {
	  if (config.get('toobusy.enabled') && toobusy()) {
      res.statusCode = 503;
      return res.end('HTTP Error 503 - Server Busy')
	  }
	  else {
	    next();
	  }
	});

  // load the rewrites from the filesystem
  server.app.Router.loadRewrites(options, function(err) {
    this.shouldCall = true;
    rewriteFunction = rewrite(server.app.Router.rules);

    //determine if we need to even call
    server.app.use(function(req, res, next) {
      this.shouldCall = rewriteFunction.call(server.app.Router, req, res, next);
      if (!res.finished) next();
    });

    //load rewrites from our DS and handle them
    server.app.use(function (req, res, next) {

      if (!this.shouldCall) return next();

      log.debug({module: 'router'}, '[Router] processing: ' + req.url);

      if (!server.app.Router.rewritesDatasource || server.app.Router.loadDatasourceAsFile || server.app.Router.rewritesDatasource === '') return next();

      var datasource = new Datasource('rewrites', server.app.Router.rewritesDatasource, options, function(err, ds) {

        if (err) {
          console.log(err);
          throw(err);
        }

        _.extend(ds.schema.datasource.filter, { "rule": req.url });
        ds.processRequest(ds.page.name, req);

        var dataHelper = new help.DataHelper(ds, req.url);
        dataHelper.load(function(err, result) {
          if (err) {
            console.log('Error loading data in Router Rewrite module');
            return next(err);
          }

          if (result) {
            var results;
            if (typeof result === 'object') {
              results = result;
            }
            else {
              results = JSON.parse(result);
            }

            if (results && results.results && results.results.length > 0 && results.results[0].rule === req.url) {
              var rule = results.results[0];
              var location;
              if (/\:\/\//.test(rule.replacement)) {
                location = req.url.replace(rule.rule, rule.replacement);
              }
              else {
                location = 'http' + '://' + req.headers.host + req.url.replace(rule.rule, rule.replacement);
              }

              res.writeHead(rule.redirectType, {
                Location : location
              });

              res.end();
            }
            else {
              return next();
            }
          }
          else {
            return next();
          }
        });
      });
    });

    //handle generic url rewrite rules
    server.app.use(function (req, res, next) {
      var redirect = false;
      var location = req.url;

      // force a URL to lowercase
      if (config.get('rewrites.forceLowerCase')) {
        if (location !== location.toLowerCase()) {
          location = location.toLowerCase();
          redirect = true;
        }
      }

      // stripIndexPages
      if (!_.isEmpty(config.get('rewrites.stripIndexPages'))) {
        var files = config.get('rewrites.stripIndexPages');
        var re = new RegExp(files.join('|'), 'gi');
        if (location.match(re)) {
          location = location.replace(re, '');
          redirect = true;
        }
      }

      // force a trailing slash
      if (config.get('rewrites.forceTrailingSlash')) {
        var parsed = url.parse(location, true);
        if (/^([^.]*[^/])$/.test(parsed.pathname) === true) {
          location = parsed.pathname + '/' + parsed.search;
          redirect = true;
        }
      }

      if (redirect) {
        res.writeHead(301, {
          Location : 'http' + '://' + req.headers.host + location
        });
        res.end();
      }
      else {
        return next();
      }
    });

  });
};

module.exports.Router = Router;
