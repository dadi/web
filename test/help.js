/*

TO D)
datasources
 - chained, param
 - chained, query

 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
// loaded customised fakeweb module
var fakeweb = require(__dirname + '/fakeweb');
var http = require('http');
var _ = require('underscore');

var config = require(__dirname + '/../config.js');
var api = require(__dirname + '/../dadi/lib/api');
var Server = require(__dirname + '/../dadi/lib');
var Controller = require(__dirname + '/../dadi/lib/controller');
var Datasource = require(__dirname + '/../dadi/lib/datasource');
var Page = require(__dirname + '/../dadi/lib/page');

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

module.exports.addHttpInterceptForApiCheck = function() {
  var fakeToken = {
    "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
    "tokenType": "Bearer",
    "expiresIn": 1800
  }

  http.register_intercept({
    hostname: config.get('api.host'),
    port: config.get('api.port'),
    path: '/',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  // fake token post
  http.register_intercept({
    hostname: config.get('api.host'),
    port: config.get('api.port'),
    path: '/token',
    method: 'POST',
    agent: new http.Agent({ keepAlive: true }),
    headers: { 'Content-Type': 'application/json' },
    body: fakeToken
  });
}

module.exports.addHttpIntercept = function(endpoint, status, body) {
  http.register_intercept({
    hostname: config.get('api.host'),
    port: config.get('api.port'),
    path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + endpoint,
    method: 'GET',
    agent: new http.Agent({ keepAlive: true }),
    headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
    body: body,
    statusCode: status
  });
}

module.exports.startServer = function(pages, done) {

  if (pages !== null && !_.isArray(pages)) {
    pages = [pages];
  }

  var options = {
    pagePath: __dirname + '/../app/pages',
    eventPath: __dirname + '/../app/events'
  };

  var options = this.getPathOptions();

  Server.app = api();
  Server.components = {};

  if (pages === null) {
    // create a page
    var name = 'test';
    var schema = this.getPageSchema();
    pages = [];
    page = Page(name, schema);
    var dsName = 'car-makes-unchained';

    page.datasources = ['car-makes-unchained'];

    var ds = Datasource(page, dsName, options, function() {} );

    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.events = [];
    delete page.route.constraint;

    pages.push(page);
  }

  Server.start(function() {
    setTimeout(function() {
      pages.forEach(function(page) {
        // create a handler for requests to this page
        var controller = Controller(page, options);

        Server.addComponent({
            key: page.key,
            route: page.route,
            component: controller
        }, false);
      })

      done();
    }, 200);
  });
}

module.exports.stopServer = function(done) {
  http.clear_intercepts();

  Server.stop(function() {
    setTimeout(function() {
      done();
    }, 200);
  });
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
  	datasourcePath: __dirname + '/../test/app/datasources',
		pagePath: __dirname + '/../test/app/pages',
		partialPath: __dirname + '/../test/app/partials',
		eventPath: __dirname + '/../test/app/events',
		routesPath: __dirname + '/../test/app/routes'
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

module.exports.clearCache = function () {
    var deleteFolderRecursive = function(filepath) {
      if( fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory() ) {
        fs.readdirSync(filepath).forEach(function(file,index){
          var curPath = filepath + "/" + file;
          if(fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(path.resolve(curPath));
          }
        });
        fs.rmdirSync(filepath);
      } else if(fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()) {
      	fs.unlinkSync(filepath);
      }
    };

    // for each directory in the cache folder, remove all files then
    // delete the folder
    fs.readdirSync(config.get('caching.directory.path')).forEach(function (dirname) {
        deleteFolderRecursive(path.join(config.get('caching.directory.path'), dirname));
    });
}
