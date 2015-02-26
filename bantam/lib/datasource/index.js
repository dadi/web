var fs = require('fs');
var _ = require('underscore');
var logger = require(__dirname + '/../log');

var Datasource = function (page, datasource, options) {
  if (!page) throw new Error('Page instance required');
  
  this.page = page;
  this.name = datasource;
  this.options = options || {};

  var self = this;

  this.schema = this.loadDatasource();
  this.source = this.schema.datasource.source;
  
  this.buildEndpoint(function(endpoint) {
    self.endpoint = endpoint;
  });
};

Datasource.prototype.loadDatasource = function() {

  var filepath = this.options.datasourcePath + "/" + this.name + ".json";
  var schema;

  // get the datasource schema
  if (!fs.existsSync(filepath)) {
    throw new Error('Page "' + this.page.name + '" references datasource "' + this.name + '" which can\'t be found in "' + this.options.datasourcePath + '"');
  }
  
  try {
    schema = require(filepath);
  }
  catch (err) {
    throw new Error('Error loading datasource schema "' + filepath + '". Is it valid JSON? ' + err);
  }

  return schema;
};

Datasource.prototype.buildEndpoint = function(done) {
  
  if (this.schema.datasource.source.type === 'static') return;
  
  var self = this;
  var uri = "";

  var protocol = this.schema.datasource.source.protocol || "http";
  var host = this.schema.datasource.source.host || "";
  var port = this.schema.datasource.source.port || "";
  
  uri = [protocol, "://", host, port != "" ? ":" : "", port, "/", this.schema.datasource.source.endpoint].join("");

  self.processDatasourceParameters(uri, function(endpoint) {
    done(endpoint);
  });
};

Datasource.prototype.processDatasourceParameters = function (uri, done) {

  // TODO accept params from the querystring, e.g. "page"

  var query = "?";
  
  var params = [
    {"count": (this.schema.datasource.count || 0)},
    {"page": (this.schema.datasource.page || 0)},
    {"search": this.schema.datasource.search},
    {"fields": this.schema.datasource.fields}
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

module.exports = function (page, datasource, options) {
  return new Datasource(page, datasource, options);
};

module.exports.Datasource = Datasource;
