var path = require("path")
var http = require("http")
var url = require("url")

var Middleware = function(app) {
  app.use("/feature/*", function(req, res, next) {})
}

module.exports = function(app) {
  return new Middleware(app)
}

module.exports.Middleware = Middleware
