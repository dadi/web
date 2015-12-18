/*

TO DO

page with request params
page with query params
page with request params and query params

routing
 - req.params
 - querystring append
 - trailing slash
 - test constraints

datasources
 - chained, param
 - chained, query

 */


var assert = require('assert');
var fs = require('fs');
var path = require('path');

function cookie(res) {
  var setCookie = res.headers['set-cookie'];
  return (setCookie && setCookie[0]) || undefined;
}

module.exports.shouldSetCookie = function(name) {
  return function (res) {
    var header = cookie(res);
    assert.ok(header, 'should have a cookie header');
    assert.equal(header.split('=')[0], name, 'should set cookie ' + name);
  };
}

module.exports.shouldNotHaveHeader = function(header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have ' + header + ' header');
  };
}

module.exports.getPageSchema = function () {
    return {
	    "page": {
        "name": "Car Reviews",
        "description": "A collection of car reviews.",
        "language": "en"
	    },
	    "settings": {
	      "cache": true
	    },
	    "route": {
	    	"path": "/car-reviews/:make/:model",
	    },
	    "contentType": "text/html",
	    "template": "car-reviews.dust",
	    "datasources": [
        "car-makes"
	    ],
	    "events": [
	    	"car-reviews"
	    ]
	}
}

module.exports.getPathOptions = function () {
  return {
  	datasourcePath: __dirname + '/../test/workspace/data-sources',
		pagePath: __dirname + '/../test/workspace/pages',
		partialPath: __dirname + '/../test/workspace/partials',
		eventPath: __dirname + '/../test/workspace/events',
		routesPath: __dirname + '/../test/workspace/routes'
  }
};

module.exports.getSchemaFromFile = function (path, name, propertyToDelete) {
	var filepath = path + "/" + name + ".json";
	var schema;
  if (fs.existsSync(filepath)) {
		schema = JSON.parse(fs.readFileSync(filepath, {encoding: 'utf-8'}));
		if (typeof propertyToDelete !== 'undefined') {
			delete schema.datasource[propertyToDelete];
		}
		return schema;
  }
}
