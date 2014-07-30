var http = require('http');
var express = require('express');
var morgan  = require('morgan');
var util = require('util');
var favicon = require('serve-favicon');
var Step = require('step');
var fs = require('fs');
var JSON5 = require('json5');
var _ = require('underscore');
var winston = require('winston');
var Q = require('q');

var pf = require('./lib/parseFile');

var dust = require('dustjs-linkedin');
var cons = require('consolidate');

var app = express();

app.engine('dust', cons.dust);
app.set('template_engine', 'dust');
app.set('domain', 'localhost');
app.set('port', process.env.PORT || 8080);
app.set('views', __dirname + '/workspace/pages');
app.set('view engine', 'dust');

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(morgan());


var logger = new winston.Logger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'log/all-logs.log' })
    //new winston.transports.MongoDB({ db: 'rosecomb', level: 'info'})
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'log/exceptions.log' })
  ]
});

var page = "";
var errors = {};

app.get('/', function(req, res) {
  var template_engine = req.app.settings.template_engine;
	res.locals.session = req.session;
  res.render('index', { title: 'Express with '+template_engine });
});

app.get('/:page', function(req, res) {

  page = req.params.page;

  logger.info("Page '" + page + "' requested");

  var datasources = {};
//  var descriptor = getDescriptor(page);

  // takes a page name and attempts to read a definition file
  // for that page, returning a JSON object representing the page definition
  function getPageDefinition(page) {

      logger.info("[Loading page definition file: " + page + "]");

      var filename = "workspace/pages/" + page + ".json";
      var deferred = Q.defer();

      pf(filename, function(result) {
          // result is a JSON object containing the page definition
          deferred.resolve(result);
      });

      return deferred.promise;
  }

  var datasourceArray = [];

  function getDatasources(datasources, callback) {
      var the_datasources = [];

      datasources.forEach(function(datasource) {
          var deferred = Q.defer();

          getDatasource(datasource)
            .then(function(datasourceDefinition) {
              // result is a JSON object containing the datasource definition
              //datasourceArray.push(result);
              return processParameters(datasourceDefinition).then(function(query) {

                return makeRequest(query).then(function(output){
                  console.log(output);
                  // datasourceArray.push({"articles": output});
                  callback(output);
                });


              });
          });

          the_datasources.push(deferred.promise);
      });

      return Q.all(the_datasources);
  }

  function getDatasource(datasource) {

    logger.info("[Loading datasource definition file: " + datasource + "]");

    var filename = "workspace/data-sources/" + datasource + ".json";
    var deferred = Q.defer();

    pf(filename, function(datasourceDefinition) {
      // result is a JSON object containing the datasource definition
      logger.info("[Datasource definition: " + datasourceDefinition.datasource.key + "] " + JSON.stringify(datasourceDefinition));
      deferred.resolve(datasourceDefinition);
    });

    return deferred.promise;
  }

  // 'settings' argument passed in the second promise
  // is the JSON page definition for the 'page' argument
  getPageDefinition(page)
    .then(function(settings) {
      // use the settings contained in the page definition to attach datasources
      return getDatasources(settings.datasources, function(data) {
        
        // this is the final step, where we render the data
        console.log("result? " + data);
        res.render("articles", JSON.parse(data));

      });
  });

  // make the actual request to the API endpoint
  // specified in the page descriptor file
  function makeRequest(query) {

    var deferred = Q.defer();

    console.log("QUERY: " + JSON.stringify(query));

    // TODO set the API host from config
    var options = {
      host: 'localhost',
      port: '8888',
      path: '/' + query,
      method: 'GET'
    };

    req = http.request(options, function(res) {
      
      console.log('STATUS: ' + res.statusCode);

      var output = '';

      res.on('data', function(chunk) {
        output += chunk;
      });

      res.on('end', function() {
        console.log(page + ": " + output);

        console.log('End GET Request');

        deferred.resolve(output);
      });

      req.on('error', function(err) {
        console.log('Error: ' + err);
      });

    });

    req.end();

    return deferred.promise;
  }

  function processParameters(datasource) {

    logger.info("[Process parameters: " + datasource.datasource.key + "]");

    // TODO accept params from the querystring, e.g. "page"

    var endpoint = datasource.datasource.endpoint;
    var query = "?";
		var params = [
      {"count": (datasource.datasource.count || 0)},
      {"page": (datasource.datasource.page || 0)},
      {"search": datasource.datasource.search},
      {"fields": datasource.datasource.fields}
    ];

    var deferred = Q.defer();

    processArray(params, function(param) {
      for (key in param) {
        if (param.hasOwnProperty(key)) {
          if (param[key] !== 0) {
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
      }

      if (params.indexOf(param) === (params.length-1)) {
        // reached the end of the param list, send query back
        deferred.resolve(endpoint + query.slice(0,-1));
      }
    });

    return deferred.promise;
	}

  function processArray(items, process) {
    var todo = items.concat();

    setTimeout(function() {
        process(todo.shift());
        if(todo.length > 0) {
            setTimeout(arguments.callee, 25);
        }
    }, 25);
  }


  function attachDatasource(err, data) {

    console.log(data.datasource);

    console.log(processParameters(data.datasource));
    //The url we want is: 'www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'
    //var url = "/" + data.datasource.endpoint;// . $this->getParameters();


    var options = {
      host: 'http://localhost:8080',
      path: data.datasource.endpoint
    };

    callback = function(response) {
      var str = '';
      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function (chunk) {
        str += chunk;
      });
      //the whole response has been recieved, so we just print it out here
      response.on('end', function () {
        console.log(str);
      });
    }

    //datasources[data.datasource.key] = data;
  }


  // Lookup page defintiion file
  // fs.readFile(filename, 'utf-8', function(err, data) {
  //   if (err) {
  //     // Missing page definition
  //     errors.page = { status: 'PAGE_DEFINITION_MISSING', message: 'Page definition missing: ' + filename };
  //   }
  //   else {
  //     try {
  //       // Is the page definition file valid JSON?
  //       settings = JSON.parse(data);
  //       attachDatasources(settings);
  //
  //       res.set('Content-Type', 'application/json');
  //       res.send(JSON.stringify(datasources, null, 4));
  //     }
  //     catch (e) {
  //       errors.page = { status: 'PAGE_DEFINITION_ISSUE', message: 'Unable to parse page definition, is it valid JSON? (' + filename + ')' };
  //       res.json(500, errors);
  //     }
  //   }
  // });

});


/**
 * Process datasource file and call the API
 **/
 //$this->attachDatasources();

/**
 * Process datasource file and call the API
 **/
 //$this->attachEvents();


// Run it
app.listen(8081, function() {
    console.log('Rosecomb listening on port %d', this.address().port);
});

