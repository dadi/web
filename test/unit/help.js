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



var fs = require('fs');

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
  	datasourcePath: __dirname + '/../workspace/datasources',
		pagePath: __dirname + '/../workspace/pages',
		partialPath: __dirname + '/../workspace/partials',
		eventPath: __dirname + '/../workspace/events',
		routesPath: __dirname + '/../workspace/routes'
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
