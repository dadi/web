/* Node module includes */
var path = require('path');
var http = require("http");
var querystring = require('querystring');

/* Rosecomb includes */
var config = require(__dirname + '/../../config.json');
var help = require(__dirname + '/../../bantam/lib/help');

var Event = function (req, res, callback) {
  var data = {};

  if (1==1) {
    data = {
      carMakeID: "req.body.carMakeID",
      carModelID: "req.body.carModelID",
      carDerID: "req.body.carDerID",
      carDer: "req.body.carDer",
      carYear: "req.body.carYear",
      carMake: "req.body.carMake",
      carModel: "req.body.carModel",
      carVRN: "req.body.carVRN"
    };
  }
  else {
    data = {};
  }
  
  //console.log(data);
  callback(data); 
};

module.exports = function (req, res, callback) {
    return new Event(req, res, callback);
};

module.exports.Event = Event;
