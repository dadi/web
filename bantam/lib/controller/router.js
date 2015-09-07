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
    _.each(rewrites.rewrites, function(rewrite) {
        var rule = rewrite.match + " " + rewrite.replace + " " + (rewrite.flags ? rewrite.flags : "");
        self.rules.push(rule);
    });
  }

}

Router.prototype.constrain = function(route, fn) {
  if (!this.handlers[fn]) {
    console.log("Route constraint function '" + fn + "' not found. Is it defined in '/workspace/routes/constraints.js'?");
  }

  this.constraints[route] = fn;
}

Router.prototype.testConstraint = function(route, req, res, callback) {
  console.log("testConstraint: " + req.url);
  console.log("testConstraint: " + route);
  if (this.handlers[this.constraints[route]]) {
    console.log("testConstraint: found fn");
    this.handlers[this.constraints[route]](req, res, function (result) {
      console.log("testConstraint: result: " + result);
      return callback(result);
    });
  }
  else {
    return callback(true);
  }
}

module.exports = function (server, options) {

    server.app.Router = new Router(options);

    console.log("Router in place...");

    if (!_.isEmpty(server.app.Router.rules)) {
        server.app.use(modRewrite(server.app.Router.rules));

        console.log("Redirects loaded...");
        console.log(server.app.Router.rules);
    }

    server.app.use(function (req, res, next) {

      console.log("Router response...");
      console.log(req.url);

      next();
        
    });

};

module.exports.Router = Router;
