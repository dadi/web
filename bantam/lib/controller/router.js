/*

REWRITE INFO:
https://github.com/tinganho/connect-modrewrite

*/

var fs = require('fs');
var url = require('url');
var querystring = require('querystring');
var modRewrite = require('connect-modrewrite');
var toobusy = require('toobusy-js');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var logger = require(__dirname + '/../log');

var Router = function (options) {

  this.data = {};
  this.params = {};
  this.constraints = {};
  this.options = options;
  this.handlers = null;
  this.rules = [];

  var self = this;

  // load the route constraint specifications if they exist
  if (fs.existsSync(options.routePath + '/constraints.js')) {
    this.handlers = require(options.routePath + '/constraints.js');
  }

  // load the rewrite specifications if they exist
  if (fs.existsSync(options.routePath + '/rewrites.json')) {
    var rewrites = require(options.routePath + '/rewrites.json');
    if (rewrites.rewrites && _.isArray(rewrites.rewrites)) { 
      self.rules = rewrites.rewrites;
    }
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
    console.log("\n[ROUTER] Route constraint function '" + fn + "' not found. Is it defined in '/workspace/routes/constraints.js'?\n");
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

var debugMode = function(req) {
  var query = url.parse(req.url, true).query;
  return (query.debug && query.debug.toString() === 'true');
}

module.exports = function (server, options) {

  server.app.Router = new Router(options);

  console.log("[ROUTER] Router loaded.");

  // middleware which blocks requests when we're too busy
	server.app.use(function (req, res, next) {
	  if (toobusy()) {
	    var err = new Error();
      err.statusCode = 503;
      err.json = { 'error' : 'HTTP Error 503 - Service unavailable' };
      next(err);
	  }
	  else {
	    next();
	  }
	});

  // add any loaded rewrite rules
  server.app.use(modRewrite(server.app.Router.rules));

  if (!_.isEmpty(server.app.Router.rules)) {
      console.log("[ROUTER] " + server.app.Router.rules.length + " redirects loaded:");
      console.log(server.app.Router.rules);
  }

};

module.exports.Router = Router;
