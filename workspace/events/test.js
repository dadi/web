/* Sample Node module includes */
var path = require('path');
var http = require("http");
var url = require('url');
var querystring = require('querystring');

/* Sample DADI includes */
var config = require(__dirname + '/../../config.js');
var help = require(__dirname + '/../../dadi/lib/help');

// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired
var Event = function (req, res, data, callback) {

  data.host = req.headers.host;
  data.url = req.url;
  data.params = JSON.stringify(url.parse(req.url,true).query);
  data.pathname = url.parse(req.url,true).pathname;

  callback(data);
};

module.exports = function (req, res, data, callback) {
    return new Event(req, res, data, callback);
};

module.exports.Event = Event;
