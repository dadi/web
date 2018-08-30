var path = require("path")
var http = require("http")
var url = require("url")
var querystring = require("querystring")
var pathToRegexp = require("path-to-regexp")

// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired
var Event = function(req, res, data, callback) {
  var err = new Error()
  err.statusCode = 500

  callback(err)
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
