var fs = require('fs');
var _ = require('underscore');
var logger = require(__dirname + '/../log');

var Datasource = function (page, datasource, options, callback) {
  if (page) {
      //throw new Error('Page instance required');
  
    this.page = page;
    this.name = datasource;
    this.options = options || {};

    var self = this;

    this.loadDatasource(function(schema) {
      self.schema = schema;
      self.source = schema.datasource.source;
      self.authStrategy = self.setAuthStrategy();
      self.buildEndpoint(schema, function(endpoint) {
        self.endpoint = endpoint;
        callback(self);
      });
    });
  }
};

Datasource.prototype.loadDatasource = function(done) {

  var filepath = this.options.datasourcePath + "/" + this.name + ".json";
  var schema;

  // get the datasource schema
  if (!fs.existsSync(filepath)) {
    throw new Error('Page "' + this.page.name + '" references datasource "' + this.name + '" which can\'t be found in "' + this.options.datasourcePath + '"');
  }
  
  try {
    var body = fs.readFileSync(filepath, {encoding: 'utf-8'});
    schema = JSON.parse(body);
    done(schema);
  }
  catch (err) {
    throw new Error('Error loading datasource schema "' + filepath + '". Is it valid JSON? ' + err);
  }
};

Datasource.prototype.setAuthStrategy = function() {
  
  if (!this.schema.datasource.auth) return null;
  
  var BearerAuthStrategy = require(__dirname + '/../auth/bearer');
  return new BearerAuthStrategy(this.schema.datasource.auth);
};

Datasource.prototype.buildEndpoint = function(schema, done) {
  
  if (schema.datasource.source.type === 'static') return;
  
  var self = this;
  var uri = "";

  var protocol = schema.datasource.source.protocol || "http";
  var host = schema.datasource.source.host || "";
  var port = schema.datasource.source.port || "";
  
  uri = [protocol, "://", host, port != "" ? ":" : "", port, "/", schema.datasource.source.endpoint].join("");

  self.processDatasourceParameters(schema, uri, function(endpoint) {
    done(endpoint);
  });
};

Datasource.prototype.processDatasourceParameters = function (schema, uri, done) {

  // TODO accept params from the querystring, e.g. "page"

  var query = "?";
  
  var params = [
    {"count": (schema.datasource.count || 0)},
    {"page": (schema.datasource.page || 0)},
    {"search": schema.datasource.search},
    {"filter": schema.datasource.filter || {}},
    {"fields": schema.datasource.fields}
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
      done(uri + query.slice(0,-1));
    }
  });
}

module.exports = function (page, datasource, options, callback) {
  return new Datasource(page, datasource, options, callback);
};

module.exports.Datasource = Datasource;
