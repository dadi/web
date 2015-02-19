/*

Ok, this should create a component that takes a req, res, and next function
and looks at query string and/or body of the request and accesses a given model instance.
This should accept a model instance as an argument, and return an instance that has
POST, GET, and DELETE methods that can be accessed by the request router

This will only be used for *http://{url}/{version number}/{database name}/{collection name}*
type of endpoints

*http://{url}/endpoints/{endpoint name}* type endpoints should create a custom controller that
implements methods corresponding to the HTTP methods it needs to support
*/

var fs = require('fs');
var http = require('http');
var url = require('url');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var _ = require('underscore');

var Event = require(__dirname + '/../event');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var logger = require(__dirname + '/../log');

// helpers
var sendBackJSON = help.sendBackJSON;
var sendBackJSONP = help.sendBackJSONP;
var sendBackHTML = help.sendBackHTML;
var parseQuery = help.parseQuery;

var Controller = function (page, options) {
  if (!page) throw new Error('Page instance required');
  
  this.page = page;

  this.options = options || {};

  this.datasources = {};
  this.events = {};

  var self = this;

  this.attachDatasources(function() {
    //console.log(self.datasources);
  });

  this.attachEvents(function() {
    //console.log(self.events);
  });
};

Controller.prototype.get = function (req, res, next) {
    // var options = url.parse(req.url, true).query;
    // var query = parseQuery(options.filter);

    //var settings = this.model.settings || {};
    var settings = {};

    // var limit = options.count || settings.count || 50;
    // var skip = limit * ((options.page || 1) - 1);

    // determine if this is jsonp
    var done = sendBackHTML(200, res, next);

    // if (options.sort) {
    //     var sort = {};

    //     // default to 'asc'
    //     var order = (options.sortOrder || settings.sortOrder) === 'desc' ? -1 : 1;

    //     sort[options.sort] = order;
    // }

    // // white list user specified options
    // options = {
    //     limit: limit,
    //     skip: skip
    // };
    // if (sort) options.sort = sort;
    
    self = this;

    var data = {
      "title": self.page.name
    }

    var template = _.find(_.keys(dust.cache), function (k){ return k.indexOf(self.page.name) > -1; });
    if (!template) {
      return sendBackHTML(500, res, next)(null, "Dust template not found");
    }

    self.loadData(req, res, data, function(data) {      
      // Render the compiled template
      var rendered = dust.render(self.page.name, data, function(err, result) {
        if (err) done(err, null);
        done(err, result);
      });
    })
};

Controller.prototype.loadData = function(req, res, data, done) {
  var idx = 0;
  var self = this;
  _.each(self.datasources, function(value, key) {
    self.getData(self.datasources[key], function(result) {
      data[key] = JSON.parse(result);
      idx++;
      
      // if we're at the end of the datasources array, 
      // start processing the attached events
      if (idx === Object.keys(self.datasources).length) {

        idx = 0;
        _.each(self.events, function(value, key) {
          
            self.events[key].run(req, res, function(result) {
              data[key] = result;
            });

            idx++;

            // return the data if we're at the end of the events
            // array, we have all the responses to render the page
            if (idx === Object.keys(self.events).length) {
              done(data);
            }
        });
      }
    });
  });
};

Controller.prototype.getData = function(query, done) {

    // TODO add authentication request
    // TODO allow non-Serama endpoints
    
    var token = '79654917-6110-4b20-8781-486d1c25f1e1';

    var headers = { 'Authorization': 'Bearer ' + token }

    var options = {
      host: config.api.host,
      port: config.api.port,
      path: '/' + query,
      method: 'GET',
      headers: headers
    };

    req = http.request(options, function(res) {
      
      var output = '';

      res.on('data', function(chunk) {
        output += chunk;
      });

      res.on('end', function() {
        done(output);
      });

      req.on('error', function(err) {
        console.log('Error: ' + err);
      });
    });

    req.end();
};

Controller.prototype.post = function (req, res, next) {

    // internal fields
    var internals = {
        apiVersion: req.url.split('/')[1]
    };

    // if id is present in the url, then this is an update
    if (req.params.id) {
        internals.lastModifiedAt = Date.now();
        internals.lastModifiedBy = req.client && req.client.clientId;
        return this.model.update({
            _id: req.params.id
        }, req.body, internals, sendBackJSON(200, res, next));
    }

    // if no id is present, then this is a create
    internals.createdAt = Date.now();
    internals.createdBy = req.client && req.client.clientId;

    this.model.create(req.body, internals, sendBackJSON(200, res, next));
};

Controller.prototype.delete = function (req, res, next) {
    var id = req.params.id;
    if (!id) return next();

    this.model.delete({_id: id}, function (err, results) {
        if (err) return next(err);

        if (config.feedback) {

            // send 200 with json message
            return help.sendBackJSON(200, res, next)(null, {
                status: 'success',
                message: 'Document deleted successfully'
            });
        }

        // send no-content success 
        res.statusCode = 204;
        res.end();
    });
};

Controller.prototype.attachDatasources = function(done) {    
  self = this;

  this.page.datasources.forEach(function(datasource) {
    var schema = self.getDatasource(datasource);
    var endpointQuery = self.processDatasourceParameters(schema, function(endpointQuery) {
      self.datasources[schema.datasource.key] = endpointQuery;
    });
  });

  done();
};

Controller.prototype.attachEvents = function(done) {
  var self = this;

  this.page.events.forEach(function(eventName) {
    var e = new Event(self.page.name, eventName, self.options);
    self.events[eventName] = e;
  });

  done();
};

Controller.prototype.getDatasource = function(datasource) {

  var filepath = this.options.datasourcePath + "/" + datasource + ".json";
  var schema;

  // get the datasource schema
  if (!fs.existsSync(filepath)) {
    throw new Error('Page "' + this.page.name + '" references datasource "' + datasource + '" which can\'t be found in "' + this.options.datasourcePath + '"');
  }
  
  try {
    schema = require(filepath);  
  }
  catch (e) {
    throw new Error('Error loading datasource schema "' + filepath + '". Is it valid JSON?');
  }

  return schema;
};

Controller.prototype.processDatasourceParameters = function (datasource, done) {

  // TODO accept params from the querystring, e.g. "page"

  var endpoint = datasource.datasource.endpoint;
  var query = "?";
  var params = [
    {"count": (datasource.datasource.count || 0)},
    {"page": (datasource.datasource.page || 0)},
    {"search": datasource.datasource.search},
    {"fields": datasource.datasource.fields}
  ];

  params.forEach(function(param) {
    for (key in param) {
      if (param.hasOwnProperty(key) && param[key] !== 0) {
        if (key === "fields") {
          //var fields = {};
          //for (field in param[key]) {
          //  fields[param[key][field]] = true;
          //}
          //query = query + key + "=" + JSON.stringify(fields) + "&";
          query = query + key + "=" + param[key].join() + "&";
        }
        else {
          query = query + key + "=" + (_.isObject(param[key]) ? JSON.stringify(param[key]) : param[key]) + "&";
        }
      }
    }

    if (params.indexOf(param) === (params.length-1)) {
      done(endpoint + query.slice(0,-1));
    }
  });
}

module.exports = function (page, options) {
  return new Controller(page, options);
};

module.exports.Controller = Controller;
