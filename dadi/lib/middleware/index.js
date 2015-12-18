var fs = require('fs');

var config = require(__dirname + '/../../../config');
var log = require(__dirname + '/../log');

var Middleware = function (name, options) {

  this.log = log.get().child({module: 'middleware (' + name + ')'});
  this.log.info('Middleware logging started (' + name + ').');

  this.name = name;
  this.options = options || {};
};

Middleware.prototype.load = function() {

  var filepath = this.options.middlewarePath + "/" + this.name + ".js";

  try {
    // get the file
    return require(filepath);
  }
  catch (err) {
    throw new Error('Error loading middleware "' + filepath + '". ' + err);
  }
};

Middleware.prototype.init = function(app) {
  try {
    this.load()(app);
  }
  catch (err) {
    this.log.error(err);
    throw(err);
  }
};

module.exports = function (name, options) {
  return new Middleware(name, options);
};

module.exports.Middleware = Middleware;
