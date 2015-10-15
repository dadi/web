/*

REWRITE INFO:
https://github.com/tinganho/connect-modrewrite

*/

var fs = require('fs');
var es = require('event-stream');
var url = require('url');
var querystring = require('querystring');
var modRewrite = require('connect-modrewrite');
var toobusy = require('toobusy-js');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var logger = require(__dirname + '/../log');

var Router = function (server, options) {

  this.data = {};
  this.params = {};
  this.constraints = {};
  this.options = options;
  this.handlers = null;
  this.rules = [];

  this.server = server;

  // load the route constraint specifications if they exist
  if (fs.existsSync(options.routesPath + '/constraints.js')) {
    this.handlers = require(options.routesPath + '/constraints.js');
  }

  var self = this;
  this.loadRewrites(options, function() {
    self.loadRewriteModule();
  });
}

Router.prototype.loadRewrites = function(options, done) {
  var self = this;
  
  self.rules = [];
  
  // load the rewrite specifications if they exist
  var rewritePath = options.routesPath + '/rewrites.txt';
  if (fs.existsSync(rewritePath)) {

    var rules = [];
    var stream = fs.createReadStream(rewritePath, {encoding: 'utf8'})
      .pipe(es.split("\n"))
      .pipe(es.mapSync(function(data) {
        rules.push(data);
      }));

    stream.on('end', function() {
      self.rules = rules.slice(0);
      done();
    });

  }

}

/**
 *  Attaches a function from /workspace/routes/constraints.js to the specified route
 *  @param {String} route
 *  @param {String} fn
 *  @return undefined
 *  @api public
 */
Router.prototype.constrain = function(route, fn) {
  
  // check the specified function has been loaed from /workspace/routes/constraints.js
  if (!this.handlers[fn]) {
    logger.prod("\n[ROUTER] Route constraint function '" + fn + "' not found. Is it defined in '/workspace/routes/constraints.js'?\n");
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

  logger.prod("[ROUTER] Rewrite module unloaded.");

  // add it to the stack
  this.server.app.use(modRewrite(this.rules));
  
  logger.prod("[ROUTER] Rewrite module loaded.");
  logger.prod("[ROUTER] " + this.rules.length + " rewrites/redirects loaded.");
}

var debugMode = function(req) {
  var query = url.parse(req.url, true).query;
  return (query.debug && query.debug.toString() === 'true');
}

module.exports = function (server, options) {

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

  //server.app.Router.loadRewriteModule();
};

module.exports.Router = Router;
