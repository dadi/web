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
var log = require(__dirname + '/../log');
var rewrite = require(__dirname + '/rewrite');

var Datasource = require(__dirname + '/../datasource');

var Router = function (server, options) {

  this.log = log.get().child({module: 'router'});
  this.log.info('Router logging started.')

  this.data = {};
  this.params = {};
  this.constraints = {};
  this.options = options;
  this.handlers = [];
  this.rules = [];

  this.rewritesFile = config.get('rewrites.path') === '' ? null : path.resolve(config.get('rewrites.path'));
  this.rewritesDatasource = config.get('rewrites.datasource');

  this.server = server;

  var self = this;

  // load the route constraint specifications if they exist
  try {
    delete require.cache[options.routesPath + '/constraints.js'];
    this.handlers = require(options.routesPath + '/constraints.js');
  }
  catch (err) {
    this.log.info('No route constraints loaded, file not found (' + options.routesPath + '/constraints.js' + ')');
  }
}

Router.prototype.loadRewrites = function(options, done) {

  var rules = [];
  var self = this;

  self.rules = [];

  if (!self.rewritesFile) return done();

  var stream = fs.createReadStream(self.rewritesFile, {encoding: 'utf8'});

  stream.pipe(es.split("\n"))
        .pipe(es.mapSync(function (data) {
          if (data !== "") rules.push(data);
        })
  );

  stream.on('error', function (err) {
    self.log.error('No rewrites loaded, file not found (' + self.rewritesFile + ')');
    done(err);
  });

  stream.on('end', function() {
    self.rules = rules.slice(0);
    done(null);
  });

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
        self.log.error(err);
      }

      c = ds;
      message = "Added route constraint datasource '%s' for '%s'";
    });
  }

  if (c) {
    this.constraints[route] = c;
    this.log.info(message, constraint, route);
  }
  else {
    var error = "Route constraint '" + constraint + "' not found. Is it defined in '" + this.options.routesPath + "/constraints.js' or '" + this.options.datasourcePath + "/" + constraint + ".json'?";
    var err = new Error(error);
    err.name = 'Router';
    this.log.error(error);
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

    console.log("[ROUTER] testConstraint: " + req.url);
    console.log("[ROUTER] testConstraint: " + route);

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

      help.getData(datasource, function(err, result) {

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
            self.log.error(err);
            return callback(false);
          }
        }
      });
    }
  }
}

Router.prototype.loadRewriteModule = function() {
  this.log.info("Rewrite module reload.");
  this.log.info(this.rules.length + " rewrites/redirects loaded.");
}

module.exports = function (server, options) {

  var self = this;

  server.app.Router = new Router(server, options);

  // middleware which blocks requests when we're too busy
	// server.app.use(function (req, res, next) {
	//   if (toobusy()) {
	//     var err = new Error();
 //      err.statusCode = 503;
 //      err.json = { 'error' : 'HTTP Error 503 - Service unavailable' };
 //      next(err);
	//   }
	//   else {
	//     next();
	//   }
	// });

  // load the rewrites from the filesystem
  server.app.Router.loadRewrites(options, function(err) {

    this.shouldCall = true;
    var rewriteFunction = rewrite(server.app.Router.rules);

    server.app.use(function(req, res, next) {
      this.shouldCall = rewriteFunction.call(server.app.Router, req, res, next);
      if (!res.finished) next();
    });

    server.app.use(function (req, res, next) {

      if (!this.shouldCall) return next();

      console.log('[Router] processing: ' + req.url);

      if (!server.app.Router.rewritesDatasource || server.app.Router.rewritesDatasource === '') return next();

      var datasource = new Datasource('rewrites', server.app.Router.rewritesDatasource, options, function(err, ds) {

        if (err) {
          console.log(err);
          throw(err);
        }

        _.extend(ds.schema.datasource.filter, { "rule": req.url });
        ds.processRequest(ds.page.name, req);

        help.getData(ds, function(err, result) {

          if (err) {
            this.log.error({err:err}, 'Error loading data in Router Rewrite module');
            return next(err);
          }

          if (result) {
            var results = JSON.parse(result);

            if (results && results.results && results.results.length > 0) {
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

    if (config.get('rewrites.forceTrailingSlash')) {
      // force a trailing slash
      server.app.use(function (req, res, next) {
        var parsed = url.parse(req.url, true);
        if (/^([^.]*[^/])$/.test(parsed.pathname) === true) {
          var location = 'http' + '://' + req.headers.host + parsed.pathname + '/' + parsed.search;
          res.writeHead(301, {
            Location : location
          });
          res.end();
        }
        else {
          return next();
        }
      });
    }


  });

};

module.exports.Router = Router;
