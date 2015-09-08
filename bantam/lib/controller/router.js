/*

REWRITE INFO:
https://github.com/tinganho/connect-modrewrite

*/

var fs = require('fs');
var url = require('url');
var modRewrite = require('connect-modrewrite');
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

  if (fs.existsSync(options.routePath + '/constraints.js')) {
    this.handlers = require(options.routePath + '/constraints.js');
  }

  if (fs.existsSync(options.routePath + '/rewrites.json')) {
    var rewrites = require(options.routePath + '/rewrites.json');
    if (rewrites.rewrites && _.isArray(rewrites.rewrites)) { 
      self.rules = rewrites.rewrites;
    }
  }

}

Router.prototype.constrain = function(route, fn) {
  if (!this.handlers[fn]) {
    console.log("\n[ROUTER] Route constraint function '" + fn + "' not found. Is it defined in '/workspace/routes/constraints.js'?\n");
    return;
  }

  this.constraints[route] = this.handlers[fn];
}

Router.prototype.testConstraint = function(route, req, res, callback) {

  var debug = debugMode(req);
  
  if (debug) {
    console.log("[ROUTER] testConstraint: " + req.url);
    console.log("[ROUTER] testConstraint: " + route);
  }

  if (this.constraints[route]) {
    
    if (debug) console.log("[ROUTER] testConstraint: found fn");
    
    this.constraints[route](req, res, function (result) {
      
      if (debug) console.log("[ROUTER] testConstraint: this route matches = " + result);
      
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

  server.app.use(modRewrite(server.app.Router.rules));

  if (!_.isEmpty(server.app.Router.rules)) {
      console.log("[ROUTER] " + server.app.Router.rules.length + " redirects loaded:");
      console.log(server.app.Router.rules);
  }

};

module.exports.Router = Router;
