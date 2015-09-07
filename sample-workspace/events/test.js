/* Sample Node module includes */
var path = require('path');
var http = require("http");
var querystring = require('querystring');

/* Sample Rosecomb includes */
var config = require(__dirname + '/../../config.json');
var help = require(__dirname + '/../../bantam/lib/help');

// the `data` parameter contains the data already loaded by 
// the page's datasources and any previous events that have fired
var Event = function (req, res, data, callback) {

  var result = {};

  if (data['car-makes'] && data['car-makes']['results'] && data['car-makes']['results'][0]) {
    result = {
      carMakeFromEvent: data['car-makes']['results'][0].name
    };
  }
  else {
    result = {
      carMakeFromEvent: "No make found!"
    }; 
  }
  
  callback(result);
};

module.exports = function (req, res, data, callback) {
    return new Event(req, res, data, callback);
};

module.exports.Event = Event;
