/*

REWRITE INFO:
https://github.com/tinganho/connect-modrewrite

*/

var fs = require('fs');
var es = require('event-stream');
var lineReader = require('line-by-line');
var url = require('url');
var querystring = require('querystring');
var modRewrite = require('connect-modrewrite');
var toobusy = require('toobusy-js');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../log');

var Datasource = require(__dirname + '/../datasource');

var Router = function (server, options) {

  this.data = {};
  this.params = {};
  this.constraints = {};
  this.options = options;
  this.handlers = null;
  this.rules = [];

  this.rewritesFile = config.get('rewrites.path');
  this.rewritesDatasource = config.get('rewrites.datasource');

  this.server = server;

  var self = this;

  // load the route constraint specifications if they exist
  try {
    delete require.cache[options.routesPath + '/constraints.js'];
    this.handlers = require(options.routesPath + '/constraints.js');
  }
  catch (err) {
    log.info('[ROUTER] No route constraints loaded, file not found (' + options.routesPath + '/constraints.js' + ')');
  }

  // load the rewrites from the filesystem
  if (this.rewritesFile && this.rewritesFile !== '') {
    this.loadRewrites(options, function(err) {
      if (!err) self.loadRewriteModule();
    });
  }
}

// Router.prototype.loadRewrites = function(options, done) {
//   var self = this;
  
//   self.rules = [];
  
//   // load the rewrite specifications if they exist
//   var rewritePath = options.routesPath + '/rewrites.txt';

//   var lr = new lineReader(rewritePath);
//   var rules = [];

//   lr.on('error', function (err) {
//     log.error(err);
//     done();
//   });

//   lr.on('line', function (line) {
//     if (line !== "") rules.push(line);
//   });

//   lr.on('end', function () {
//     self.rules = rules.slice(0);
//     done();    
//   });
// }

Router.prototype.loadRewrites = function(options, done) {
  
  var rules = [];
  var self = this;  
  
  self.rules = [];
  
  var stream = fs.createReadStream(self.rewritesFile, {encoding: 'utf8'});

  stream.pipe(es.split("\n"))
        .pipe(es.mapSync(function (data) {
          if (data !== "") rules.push(data);
        })
  );

  stream.on('error', function (err) {
    log.error('[ROUTER] No rewrites loaded, file not found (' + self.rewritesFile + ')');
    done(err);
  });

  stream.on('end', function() {
    self.rules = rules.slice(0);
    done(null);
  });

}

/**
 *  Attaches a function from /workspace/routes/constraints.js to the specified route
 *  @param {String} route
 *  @param {String} fn
 *  @return undefined
 *  @api public
 */
Router.prototype.constrain = function(route, fn) {
  
  // check the specified function has been 
  // loaded from /workspace/routes/constraints.js
  if (!this.handlers[fn]) {
    log.error("\n[ROUTER] Route constraint function '" + fn + "' not found. Is it defined in '/workspace/routes/constraints.js'?\n");
    return;
  }

  this.constraints[route] = this.handlers[fn];
}

/**
 *  Attaches a function from /workspace/routes/constraints.js to the specified route
 *  @param {String} route
 *  @return `true` if `route` can be handled by a route handler, or if no handler matches the route. `false`
 *  if a route handler matches but returned false when tested.
 *  @api public
 */
Router.prototype.testConstraint = function(route, req, res, callback) {

  var debug = debugMode(req);
  
  if (debug) {
    console.log("[ROUTER] testConstraint: " + req.url);
    console.log("[ROUTER] testConstraint: " + route);
  }

  // if there's a constraint handler for this route, run it
  if (this.constraints[route]) {
    
    if (debug) console.log("[ROUTER] testConstraint: found fn");
    
    this.constraints[route](req, res, function (result) {
      
      if (debug) console.log("[ROUTER] testConstraint: this route matches = " + result);
      
      // return the result
      return callback(result);
    });
  }
  else {
    // no constraint against this route,
    // let's use it
    return callback(true);
  }
}

Router.prototype.loadRewriteModule = function() {
  // remove it from the stack
  this.server.app.unuse(modRewrite(this.rules));

  log.info("[ROUTER] Rewrite module unloaded.");

  // add it to the stack
  this.server.app.use(modRewrite(this.rules));
  
  log.info("[ROUTER] Rewrite module loaded.");
  log.info("[ROUTER] " + this.rules.length + " rewrites/redirects loaded.");
}

var debugMode = function(req) {
  var query = url.parse(req.url, true).query;
  return (query.debug && query.debug.toString() === 'true');
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
 

  server.app.use(function (req, res, next) {

    if (!server.app.Router.rewritesDatasource || server.app.Router.rewritesDatasource === '') return next();

    var datasource = new Datasource(null, server.app.Router.rewritesDatasource, options, function(err, ds) {
      
      if (err) {
        log.error(err);
        return next();
      }

      //console.log(ds);

      help.getData(ds, function(err, result) {
        
        if (err) return done(err);

        if (result) {
          //console.log(result);

          return next();
          // try {
          //   data[key] = (typeof result === 'object' ? result : JSON.parse(result));
          // }
          // catch (e) {
          //   console.log(e);
          // }
        }
      });

    });
  })

  //server.app.Router.loadRewriteModule();
};

module.exports.Router = Router;
