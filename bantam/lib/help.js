var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');
var util = require('util');
var _ = require('underscore');

var log = require(__dirname + '/log');
var token = require(__dirname + '/auth/token');
var DatasourceCache = require(__dirname + '/cache/datasource');

var config = require(__dirname + '/../../config.js');

var self = this;

module.exports.htmlEncode = function(input) {
    var encodedStr = input.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#'+i.charCodeAt(0)+';';
    });
    return encodedStr;
}

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
    return function (err, results) {
        if (err) return next(err);

        var resBody = JSON.stringify(results, null, 4);

        res.setHeader('Server', config.get('app.name'));

        res.statusCode = successCode;
        res.setHeader('content-type', 'application/json');
        res.setHeader('content-length', Buffer.byteLength(resBody));
        res.end(resBody);
    }
}

module.exports.sendBackJSONP = function (callbackName, res, next) {
    return function (err, results) {

        // callback MUST be made up of letters only
        if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400);

        res.statusCode = 200;

        var resBody = JSON.stringify(results);
        resBody = callbackName + '(' + resBody + ');';
        res.setHeader('content-type', 'text/javascript');
        res.setHeader('content-length', resBody.length);
        res.end(resBody);
    }
}

// helper that sends html response
module.exports.sendBackHTML = function (successCode, contentType, res, next) {
    return function (err, results) {
        if (err) return next(err);

        var resBody = results;

        res.statusCode = successCode;
        res.setHeader('Server', config.get('app.name'));
        //res.setHeader('Cache-Control', 'private, max-age=600');
        res.setHeader('content-type', contentType);
        res.setHeader('content-length', Buffer.byteLength(resBody));

        res.end(resBody);
    }
}

module.exports.getStaticData = function(datasource, done) {

    var data = datasource.source.data;
    
    if (_.isArray(data)) {
        var sortField = datasource.schema.datasource.sort.field;
        var sortDir = datasource.schema.datasource.sort.order;
        var search = datasource.schema.datasource.search;
        var count = datasource.schema.datasource.count;
        var fields = datasource.schema.datasource.fields;

        if (search) data = _.where(data, search);
        if (sortField) data = _.sortBy(data, sortField);
        if (sortDir === 'desc') data = data.reverse();

        if (count) data = _.first(data, count);

        if (fields) data = _.chain(data).selectFields(fields.join(",")).value();
    }

    done(data);
}

module.exports.getData = function(datasource, done) {

    // TODO allow non-Serama endpoints    
    var datasourceCache = new DatasourceCache(datasource);

    var self = this;

    datasourceCache.getFromCache(function (cachedData) {

        if (cachedData) return done(null, cachedData);

        if (datasource.source.type === 'static') {
            self.getStaticData(datasource, function(data) {
                return done(null, data);
            });
        }

        var defaults = {
            host: datasource.source.host,
            port: datasource.source.port,
            path: datasource.endpoint,
            method: 'GET'
        };

        self.getHeaders(datasource, function(headers) {

            var options = _.extend(defaults, headers);

            req = http.request(options, function(res) {

              log.info('[DATA] ' + options.path);
              
              var output = '';
     
              res.on('data', function(chunk) {
                output += chunk;
              });
        
              res.on('end', function() {

                // if response is not 200 don't cache
                if (res.statusCode === 200) datasourceCache.cacheResponse(output);

                if (res.statusCode >= 400) {
                    var err = new Error();
                    err.statusCode = res.statusCode;
                    err.json = { "error" : res.statusMessage + ' (' + res.statusCode + ')' + ": " + datasource.endpoint };

                    log.info('[DATA] ' + res.statusMessage + ' (' + res.statusCode + ')' + ": " + datasource.endpoint);

                    //return done(err);
                }
        
                return done(null, output);
              });
        
            });
        
            req.on('error', function(err) {
               log.error('[DATA] help.getData error (' + JSON.stringify(req._headers)  + '): ' + err + '(' + datasource.endpoint + ')');
               return done('{ "error" : "Connection refused" }');
            });
        
            try {
                req.end();
            }
            catch (e) {
        
            }
        });
    });
};

module.exports.getHeaders = function(datasource, done) {
    var headers;
    if(datasource.authStrategy){
        datasource.authStrategy.getToken(datasource, function (token){
            done({headers: {'Authorization': 'Bearer ' + token}} );
        });
    }
    else {
        done( {headers:{'Authorization': 'Bearer ' + token.authToken.accessToken }});
    }
};

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function (queryStr) {
    var ret;
    try {
        // strip leading zeroes from querystring before attempting to parse
        ret = JSON.parse(queryStr.replace(/\b0(\d+)/, "\$1"));
    }
    catch (e) {
        ret = {};
    }

    // handle case where queryStr is "null" or some other malicious string
    if (typeof ret !== 'object' || ret === null) ret = {};
    return ret;
}

// creates a new function in the underscore.js namespace
// allowing us to pluck multiple properties - used to return only the 
// fields we require from an array of objects
_.mixin({selectFields: function() {
        var args = _.rest(arguments, 1)[0];
        return _.map(arguments[0], function(item) {
            var obj = {};
            _.each(args.split(','), function(arg) {
                obj[arg] = item[arg]; 
            });
            return obj;
        });
    }
});
