var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var _ = require('underscore');
var controller = require(__dirname + '/controller');
var page = require(__dirname + '/page');
var api = require(__dirname + '/api');
// var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var logger = require(__dirname + '/log');
var help = require(__dirname + '/help');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');

var configPath = path.resolve(__dirname + '/../../config.json');
var config = require(configPath);

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
var idParam = ':id([a-fA-F0-9]{24})?';

var Server = function () {
    this.components = {};
    this.monitors = {};
};

Server.prototype.start = function (options, done) {
    var self = this;

    this.readyState = 2;
    options || (options = {});

    // create app
    var app = this.app = api();

    // add necessary middlewares in order below here...

    app.use(bodyParser.json());
    app.use(bodyParser.text());

    // configure authentication middleware
    //auth(self);

    dust.isDebug = true;

    // request logging middleware
    app.use(function (req, res, next) {
        var start = Date.now();
        var _end = res.end;
        res.end = function () {
            var duration = Date.now() - start;

            // log the request method and url, and the duration
            logger.prod(req.method
                + ' ' + req.url
                + ' ' + res.statusCode
                + ' ' + duration + 'ms');
            _end.apply(res, arguments);
        };
        next();
    });

    //this.loadConfigApi();

    // caching layer
    cache(self);

    // start listening
    var server = this.server = app.listen(config.server.port, config.server.host);

    server.on('listening', function (e) {
      logger.prod('Started server on ' + config.server.host + ':' + config.server.port);
    });

    server.on('error', function (e) {
      if (e.code == 'EADDRINUSE') {
        console.log('Error ' + e.code + ': Address ' + config.server.host + ':' + config.server.port + ' is already in use, is something else listening on port ' + config.server.port + '?\n\n');
        process.exit(0);
      }
    });

    this.loadApi(options);

    this.readyState = 1;

    // this is all sync, so callback isn't really necessary.
    done && done();
};

// this is mostly needed for tests
Server.prototype.stop = function (done) {
    var self = this;
    this.readyState = 3;

    Object.keys(this.monitors).forEach(this.removeMonitor.bind(this));

    Object.keys(this.components).forEach(this.removeComponent.bind(this));

    this.server.close(function (err) {
        self.readyState = 0;
        done && done(err);
    });
};

Server.prototype.loadApi = function (options) {
    options || (options = {});

    var self = this;

    var datasourcePath = this.datasourcePath = options.datasourcePath || __dirname + '/../../workspace/data-sources';
    var pagePath = this.pagePath = options.pagePath || __dirname + '/../../workspace/pages';
    var partialPath = this.partialPath = options.partialPath || __dirname + '/../../workspace/partials';
    var eventPath = this.eventPath = options.eventPath || __dirname + '/../../workspace/events';

    options.datasourcePath = datasourcePath;
    options.pagePath = pagePath;
    options.partialPath = partialPath;
    options.eventPath = eventPath;

    self.updateDatasources(datasourcePath);
    self.updateEvents(eventPath);
    
    // load routes
    self.updatePages(pagePath, options);
    
    // compile all dust templates
    self.dustCompile(options);

    // configure "index" route
    this.app.use('/', function (req, res, next) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      var data = {
        "title": "Index"
      }

      var test = dust.render("index", data, function(err, result) {
        if (err) {
          logger.prod(err);
          res.body = err;
          res.end();
        }
        res.end(result);
      });
    });

    self.addMonitor(pagePath, function (pageFile) {
        self.updatePages(pagePath, options);
        self.dustCompile(options);
    });

    self.addMonitor(partialPath, function (partialFile) {
        self.dustCompile(options);
    });

    //this.updateEndpoints(endpointPath);

    // this.addMonitor(endpointPath, function (endpointFile) {
    //     var filepath = path.join(endpointPath, endpointFile);

    //     // need to ensure filepath exists since this could be a removal
    //     if (endpointFile && fs.existsSync(filepath)) {
    //         return self.addEndpointResource({
    //             endpoint: endpointFile,
    //             filepath: filepath
    //         });
    //     }
    //     self.updateEndpoints(endpointPath);
    // });
    
    logger.prod('Server load complete');
};

Server.prototype.loadConfigApi = function () {
    var self = this;

    // allow getting main config from API
    this.app.use('/serama/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();

        if (method === 'get') return help.sendBackJSON(200, res, next)(null, config);

        if (method === 'post') {

            // update the config file
            var newConfig = _.extend({}, config, req.body);

            return fs.writeFile(configPath, JSON.stringify(newConfig), function (err) {
                help.sendBackJSON(200, res, next)(err, {
                    result: 'success',
                    message: 'server restart required'
                });
            });
        }

        next();
    });

    // listen for requests to add to the API
    this.app.use('/:version/:database/:collectionName/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        var schemaString = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        if (typeof schemaString !== 'string') {
            var err = new Error('Bad Syntax');
            err.statusCode = 400;
            return next(err);
        }

        var params = req.params;

        var route = ['', params.version, params.database, params.collectionName, idParam].join('/');

        // create schema
        if (!self.components[route]) {
            self.createDirectoryStructure(path.join(params.version, params.database));

            var schemaPath = path.join(
                self.collectionPath,
                params.version,
                params.database,
                'collection.' + params.collectionName + '.json'
            );

            try {
                
                fs.writeFileSync(schemaPath, schemaString);

                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({
                    result: 'success',
                    message: params.collectionName + ' collection created'
                }));

            }
            catch (err) {
                return next(err);
            }
        }

        next();
    });

    // this.app.use('/endpoints/:endpointName/config', function (req, res, next) {
    //     var method = req.method && req.method.toLowerCase();
    //     if (method !== 'post') return next();

    //     var name = req.params.endpointName;
    //     if (!self.components['/endpoints/' + name]) {
    //         var filepath = path.join(self.endpointPath, 'endpoint.' + name + '.js');

    //         return fs.writeFile(filepath, req.body, function (err) {
    //             if (err) return next(err);

    //             res.statusCode = 200;
    //             res.setHeader('content-type', 'application/json');
    //             res.end(JSON.stringify({
    //                 result: 'success',
    //                 message: req.params.endpointName + ' endpoint created'
    //             }));
    //         });
    //     }

    //     next();
    // });
};

// Server.prototype.updateVersions = function (versionsPath) {
//     var self = this;

//     // Load initial api descriptions
//     var versions = fs.readdirSync(versionsPath);

//     versions.forEach(function (version) {
//         if (version.indexOf('.') === 0) return;

//         var dirname = path.join(versionsPath, version);
//         self.updateDatabases(dirname);

//         self.addMonitor(dirname, function (databaseName) {
//             if (databaseName) return self.updateCollections(path.join(dirname, databaseName));
//             self.updateDatabases(dirname);
//         });
//     });
// };

// Server.prototype.updateDatabases = function (databasesPath) {
//     var self = this;
//     var databases;
//     try {
//         databases = fs.readdirSync(databasesPath);
//     } catch (e) {
//         logger.prod(databasesPath + ' does not exist');
//         return;
//     }

//     databases.forEach(function (database) {
//         if (database.indexOf('.') === 0) return;

//         var dirname = path.join(databasesPath, database);
//         self.updateCollections(dirname);

//         self.addMonitor(dirname, function (collectionFile) {
//             self.updateCollections(dirname);
//         });
//     });
// };

Server.prototype.updateDatasources = function (directoryPath) {
    
    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var datasources = fs.readdirSync(directoryPath);

    datasources.forEach(function (datasource) {
        //if (collection.indexOf('.') === 0) return;

        logger.prod('Datasource loaded: ' + datasource);
        // parse the url out of the directory structure
        // var cpath = path.join(collectionsPath, collection);
        // var dirs = cpath.split('/');
        // var version = dirs[dirs.length - 3];
        // var database = dirs[dirs.length - 2];

        // // collection should be json file containing schema
        // var name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'));

        // self.addCollectionResource({
        //     route: ['', version, database, name, idParam].join('/'),
        //     filepath: cpath,
        //     name: name
        // });
    });
};

Server.prototype.updateEvents = function (directoryPath) {
    
    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var events = fs.readdirSync(directoryPath);

    events.forEach(function (e) {
        //if (collection.indexOf('.') === 0) return;

        logger.prod('Event loaded: ' + e);
        // parse the url out of the directory structure
        // var cpath = path.join(collectionsPath, collection);
        // var dirs = cpath.split('/');
        // var version = dirs[dirs.length - 3];
        // var database = dirs[dirs.length - 2];

        // // collection should be json file containing schema
        // var name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'));

        // self.addCollectionResource({
        //     route: ['', version, database, name, idParam].join('/'),
        //     filepath: cpath,
        //     name: name
        // });
    });
};

Server.prototype.updatePages = function (directoryPath, options) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var pages = fs.readdirSync(directoryPath);

    pages.forEach(function (page) {
        if (page.indexOf('.json') < 0) return;

        // parse the url out of the directory structure
        var pageFilepath = path.join(directoryPath, page);

        // file should be json file containing schema
        var name = page.slice(0, page.indexOf('.'));

        // check for matching template file
        var templateFilepath = path.join(directoryPath, name) + ".dust";

        //if (fs.existsSync(templateFilepath)) {        

          self.addRoute({
            name: name,
            route: ['', name].join('/'),
            filepath: pageFilepath,
            template: templateFilepath
          }, options);

          logger.prod('Page loaded: ' + page);
        //}
    });
};

Server.prototype.addRoute = function (route, options) {

    // get the page schema
    try {
      var schema = require(route.filepath);
    }
    catch (e) {
      throw new Error('Error loading page schema "' + route.filepath + '". Is it valid JSON?');
    }

    // With each page we create a controller, that acts as a component of the REST api.
    // We then add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    var p = page(route.name, route.template, schema.page, schema.datasources, schema.events);
    var control = controller(p, options);

    this.addComponent({
        route: route.route,
        component: control,
        filepath: route.filepath
    });
    
    //var self = this;

    // watch the schema's file and update it in place
    // this.addMonitor(options.filepath, function (filename) {

    //     // invalidate schema file cache then reload
    //     delete require.cache[options.filepath];
    //     try {

    //         // This leverages the fact that Javscript's Object keys are references
    //         self.components[options.route].model.schema = require(options.filepath).fields;
    //         self.components[options.route].model.settings = require(options.filepath).settings;
    //     } catch (e) {

    //         // if file was removed "un-use" this component
    //         if (e && e.code === 'ENOENT') {
    //             self.removeMonitor(options.filepath);
    //             self.removeComponent(options.route);
    //         }
    //     }
    // });
};

Server.prototype.dustCompile = function (options) {

    var self = this;
    var pagePath = options.pagePath;
    var partialPath = options.partialPath;

    var self = this;
    
    var pages = fs.readdirSync(pagePath);
    pages.forEach(function (page) {
        if (page.indexOf('.dust') < 0) return;
        //Load the template from file
        var name = page.slice(0, page.indexOf('.'));
        var template =  fs.readFileSync(path.join(pagePath, page), "utf8");
        var compiled = dust.compile(template, name, true);
        dust.loadSource(compiled);
    });

    var partials = fs.readdirSync(partialPath);
    partials.forEach(function (partial) {
        //Load the template from file
        var name = partial.slice(0, partial.indexOf('.'));
        var template =  fs.readFileSync(path.join(partialPath, partial), "utf8");
        var compiled = dust.compile(template, "partials/" + name, true);
        dust.loadSource(compiled);
    });  
};

Server.prototype.addCollectionResource = function (options) {

    // get the schema
    var schema = require(options.filepath);

    // With each schema we create a model.
    // With each model we create a controller, that acts as a component of the REST api.
    // We then add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    var mod = model(options.name, schema.fields, null, schema.settings);
    var control = controller(mod);

    this.addComponent({
        route: options.route,
        component: control,
        filepath: options.filepath
    });

    var self = this;

    // watch the schema's file and update it in place
    this.addMonitor(options.filepath, function (filename) {

        // invalidate schema file cache then reload
        delete require.cache[options.filepath];
        try {

            // This leverages the fact that Javscript's Object keys are references
            self.components[options.route].model.schema = require(options.filepath).fields;
            self.components[options.route].model.settings = require(options.filepath).settings;
        } catch (e) {

            // if file was removed "un-use" this component
            if (e && e.code === 'ENOENT') {
                self.removeMonitor(options.filepath);
                self.removeComponent(options.route);
            }
        }
    });

    logger.prod('Initial ' + options.name + ' Schema loaded');
};

Server.prototype.updateEndpoints = function (endpointsPath) {
    var self = this;
    var endpoints = fs.readdirSync(endpointsPath);

    endpoints.forEach(function (endpoint) {
        self.addEndpointResource({
            endpoint: endpoint,
            filepath: path.join(endpointsPath, endpoint)
        });
    });

};

Server.prototype.addEndpointResource = function (options) {
    var endpoint = options.endpoint
    if (endpoint.indexOf('.') === 0) return;

    var self = this;
    var name = endpoint.slice(endpoint.indexOf('.') + 1, endpoint.indexOf('.js'));
    var filepath = options.filepath;

    // keep reference to component so hot loading component can be
    // done by changing reference value
    var opts = {
        route: '/endpoints/' + name,
        component: require(filepath),
        filepath: filepath
    };

    self.addComponent(opts);

    // if this endpoint's file is changed hot update the api
    self.addMonitor(filepath, function (filename) {
        delete require.cache[filepath];
        try {
            opts.component = require(filepath);
        } catch (e) {

            // if file was removed "un-use" this component
            if (e && e.code === 'ENOENT') {
                self.removeMonitor(filepath);
                self.removeComponent(opts.route);
            }
        }
    });

    logger.prod('Endpoint ' + name + ' loaded');
}

Server.prototype.addComponent = function (options) {

    // only add a route once
    if (this.components[options.route]) return;

    this.components[options.route] = options.component;

    this.app.use(options.route +'/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();

        // send schema
        if (method === 'get' && options.filepath) {

            // only allow getting collection endpoints
            if (options.filepath.slice(-5) === '.json') {
                return help.sendBackJSON(200, res, next)(null, require(options.filepath));
            }
            // continue
        }

        // set schema
        if (method === 'post' && options.filepath) {
            return fs.writeFile(options.filepath, req.body, function (err) {
                help.sendBackJSON(200, res, next)(err, {result: 'success'});
            });
        }

        // delete schema
        if (method === 'delete' && options.filepath) {

            // only allow removing collection type endpoints
            if (options.filepath.slice(-5) === '.json') {
                return fs.unlink(options.filepath, function (err) {
                    help.sendBackJSON(200, res, next)(err, {result: 'success'});
                });
            }
            // continue
        }

        next();
    });

    this.app.use(options.route, function (req, res, next) {
        // map request method to controller method
        var method = req.method && req.method.toLowerCase();
        if (method && options.component[method]) return options.component[method](req, res, next);

        next();
    });
};

Server.prototype.removeComponent = function (route) {
    this.app.unuse(route);
    delete this.components[route];
};

Server.prototype.addMonitor = function (filepath, callback) {
    filepath = path.normalize(filepath);

    // only add one watcher per path
    if (this.monitors[filepath]) return;

    var m = monitor(filepath);
    m.on('change', callback);

    this.monitors[filepath] = m;
};

Server.prototype.removeMonitor = function (filepath) {
    this.monitors[filepath] && this.monitors[filepath].close();
    delete this.monitors[filepath];
};

// Synchronously create directory structure to match path
Server.prototype.createDirectoryStructure = function (dpath) {
    var self = this;

    var directories = dpath.split(path.sep);
    var npath = self.collectionPath;
    directories.forEach(function (dirname) {
        npath = path.join(npath, dirname);
        try {
            fs.mkdirSync(npath);
        } catch (err) {}
    });
};

/**
 *  expose VERB type methods for adding routes and middlewares 
 *  @param {String} [route] optional
 *  @param {function} callback, any number of callback to be called in order
 *  @return undefined
 *  @api public
 */
Server.prototype.options = buildVerbMethod('options');
Server.prototype.get = buildVerbMethod('get');
Server.prototype.head = buildVerbMethod('head');
Server.prototype.post = buildVerbMethod('post');
Server.prototype.put = buildVerbMethod('put');
Server.prototype.delete = buildVerbMethod('delete');
Server.prototype.trace = buildVerbMethod('trace');

// singleton
module.exports = new Server();

// generate a method for http request methods matching `verb`
// if a route is passed, the node module `path-to-regexp` is
// used to create the RegExp that will test requests for this route
function buildVerbMethod(verb) {
    return function () {
        var args = [].slice.call(arguments, 0);
        var route = typeof arguments[0] === 'string' ? args.shift() : null;

        var handler = function (req, res, next) {
            if (!(req.method && req.method.toLowerCase() === verb)) {
                next();
            }

            // push the next route on to the bottom of callback stack in case none of these callbacks send a response
            args.push(next);
            var doCallbacks = function (i) {
                return function (err) {
                    if (err) return next(err);

                    args[i](req, res, doCallbacks(++i));
                }
            }

            doCallbacks(0)();
        };

        // if there is a route provided, only call for matching requests
        if (route) {
            return this.app.use(route, handler);
        }

        // if no route is provided, call this for all requests
        this.app.use(handler);
    };
}
