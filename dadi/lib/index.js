
var version = require('../../package.json').version;
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

var _ = require('underscore');
var colors = require('colors');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var mkdirp = require('mkdirp');
var serveStatic = require('serve-static');
var serveFavicon = require('serve-favicon');
var compress = require('compression');
var toobusy = require('toobusy-js');
var enableDestroy = require('server-destroy');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var raven = require('raven');
var session = require('express-session');
var mongoStore;
if (nodeVersion < 1) {
  mongoStore = require('connect-mongo/es5')(session);
}
else {
  mongoStore = require('connect-mongo')(session);
}

var controller = require(__dirname + '/controller');
var router = require(__dirname + '/controller/router');
var Page = require(__dirname + '/page');
var middleware = require(__dirname + '/middleware');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var log = require(__dirname + '/log');
var help = require(__dirname + '/help');
var dustHelpersExtension = require(__dirname + '/dust/helpers.js');

var config = require(path.resolve(__dirname + '/../../config.js'));

var Server = function () {
    this.components = {};
    this.monitors = {};

    this.log = log.get().child({module: 'server'});
    this.log.info('Server logging started.');
};

Server.prototype.start = function (done) {
    var self = this;

    this.readyState = 2;

    var options = this.loadPaths(config.get('paths') || {});

    // create app
    var app = this.app = api();

    // override config
    if (options.configPath) {
      config.loadFile(options.configPath);
    }

    if (config.get('logging.sentry.enabled')) {
      app.use(raven.middleware.express.requestHandler(config.get('logging.sentry.dsn')));
    }

    // serve static files (css,js,fonts)
    if (options.mediaPath) app.use(serveStatic(options.mediaPath, { 'index': false }));

    if (options.publicPath) {
      app.use(serveStatic(options.publicPath, { 'index': false, maxAge: '1d', setHeaders: setCustomCacheControl }));
      try {
        app.use(serveFavicon((options.publicPath || __dirname + '/../../public') + '/favicon.ico'));
      }
      catch (err) {
        // file not found
      }
    }

    // add debug files to static paths
    if (config.get('debug')) {
      app.use(serveStatic(options.workspacePath + '/debug' || (__dirname + '/../../workspace/debug') , { 'index': false }));
    }

    // add parsers
    app.use(bodyParser.json());
    app.use(bodyParser.text());
    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: true }));

    // add gzip compression
    if (config.get('headers.useGzipCompression')) {
      app.use(compress());
    }

    // request logging middleware
    app.use(log.requestLogger);

    // session manager
    var sessionConfig = config.get('sessions');

    if (sessionConfig.enabled) {
      var sessionOptions = {
        name: sessionConfig.name,
        secret: sessionConfig.secret,
        resave: sessionConfig.resave,
        saveUninitialized: sessionConfig.saveUninitialized,
        cookie: sessionConfig.cookie
      };

      var store = this.getSessionStore(sessionConfig);

      if (store) {
        sessionOptions.store = store;
      }

      // add the session middleware
      app.use(session(sessionOptions));
    }

    // add gzip compression
    if (config.get('headers.useGzipCompression')) {
      app.use(compress());
    }

    // request logging middleware
    app.use(log.requestLogger);

    if (config.get('api.enabled')) {
      // caching layer
      cache(self).init();

      // authentication layer
      auth(self);
    }

    // handle routing & redirects
    router(self, options);

    // start listening
    var server = this.server = app.listen(config.get('server.port'), config.get('server.host'));

    server.on('connection', onConnection);
    server.on('listening', onListening);
    server.on('error', onError);

    // enhance with a 'destroy' function
    enableDestroy(server);

    // load app specific routes
    this.loadApi(options);

    var virtualDirs = config.get('virtualDirectories');
    _.each(virtualDirs, function (dir) {
      app.use(serveStatic(__dirname + '/../../' + dir.path , { 'index': dir.index, 'redirect': dir.forceTrailingSlash }));
    });

    // dust configuration
    dust.isDebug = config.get('dust.debug');
    dust.debugLevel = config.get('dust.debugLevel');
    dust.config.cache = config.get('dust.cache');
    dust.config.whitespace = config.get('dust.whitespace');

    this.readyState = 1;

    //do something when app is closing
    process.on('exit', this.exitHandler.bind(null, {server: this, cleanup: true}));

    //catches ctrl+c event
    process.on('SIGINT', this.exitHandler.bind(null, {server: this, exit: true}));

    //catches uncaught exceptions
    process.on('uncaughtException', this.exitHandler.bind(null, {server: this, exit: true}));

    // this is all sync, so callback isn't really necessary.
    done && done();
}

Server.prototype.exitHandler = function(options, err) {
  var server = options.server;

  if (options.cleanup) {
    server.stop(function() {
      toobusy.shutdown();
    });
  }

  if (err) console.log(err);

  if (options.exit) {
    console.log();
    console.log('Server stopped, process exiting...');
    server.log.info('Server stopped, process exiting.');
    process.exit();
  }
}

function setCustomCacheControl(res, path) {
  _.each(config.get('headers.cacheControl'), function (value, key) {
    if (serveStatic.mime.lookup(path) === key && value !== '') {
      res.setHeader('Cache-Control', value);
    }
  });
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
    var self = this;
    this.readyState = 3;

    Object.keys(this.monitors).forEach(this.removeMonitor.bind(this));

    Object.keys(this.components).forEach(this.removeComponent.bind(this));

    this.server.destroy();

    this.server.close(function (err) {
      self.readyState = 0;
      return done && done(err);
    });
};

Server.prototype.loadPaths = function(paths) {

  var self = this;
  var options = {};

  options.datasourcePath = path.resolve(paths.datasources || __dirname + '/../../app/datasources');
  options.eventPath = path.resolve(paths.events || __dirname + '/../../app/events');
  options.pagePath = path.resolve(paths.pages || __dirname + '/../../app/pages');
  options.partialPath = path.resolve(paths.partials || __dirname + '/../../app/partials');
  options.routesPath = path.resolve(paths.routes || __dirname + '/../../app/routes');
  options.middlewarePath = path.resolve(paths.middleware || __dirname + '/../../app/middleware');

  if (paths.media) options.mediaPath = path.resolve(paths.media);
  if (paths.public) options.publicPath = path.resolve(paths.public);

  _.each(options, function(path, key) {
    fs.stat(path, function(err, stats) {
      if (err) {
        if (err.code === 'ENOENT') {

          self.ensureDirectories(options, function() {
            //
          });

        }
      }
    });
  });

  return options;
}

Server.prototype.loadApi = function (options) {

    var self = this;

    self.ensureDirectories(options, function(text) {

        // load routes
        self.updatePages(options.pagePath, options, false);

        // Load middleware
        self.initMiddleware(options.middlewarePath, options);

        // compile all dust templates
        self.dustCompile(options);

        self.addMonitor(options.datasourcePath, function (dsFile) {
            self.updatePages(options.pagePath, options, true);
        });

        self.addMonitor(options.eventPath, function (eventFile) {
            self.updatePages(options.pagePath, options, true);
        });

        self.addMonitor(options.pagePath, function (pageFile) {
            self.updatePages(options.pagePath, options, true);
            self.dustCompile(options);
        });

        self.addMonitor(options.partialPath, function (partialFile) {
            self.dustCompile(options);
        });

        self.addMonitor(options.routesPath, function (file) {
            if (self.app.Router) {
                self.app.Router.loadRewrites(options, function() {
                    self.app.Router.loadRewriteModule();
                });
            }
        });

        self.log.info('Load complete.');

    });

};

Server.prototype.initMiddleware = function (directoryPath, options) {
  var middlewares = this.loadMiddleware(directoryPath, options);
  _.each(middlewares, function(middleware) {
    middleware.init(this.app);
  }, this);
};

Server.prototype.loadMiddleware = function (directoryPath, options) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var files = fs.readdirSync(directoryPath);

    var middlewares = [];

    files.forEach(function (file) {
        if (path.extname(file) !== '.js') return;

        var filepath = path.join(directoryPath, file);
        var name = file.slice(0, file.indexOf('.'));
        var m = new middleware(name, options);
        middlewares.push(m);
    });

    return middlewares;
};

Server.prototype.updatePages = function (directoryPath, options, reload) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var pages = fs.readdirSync(directoryPath);

    pages.forEach(function (page) {
      if (path.extname(page) !== '.json') return;

      // get the full path to the page file
      var pageFilepath = path.join(directoryPath, page);

      // strip the filename minus the extension
      // to use as the page name
      var name = page.slice(0, page.indexOf('.'));

      self.addRoute({
        name: name,
        filepath: pageFilepath
      }, options, reload);

    });
};

Server.prototype.addRoute = function (obj, options, reload) {

    // get the page schema
    var schema;

    try {
      schema = require(obj.filepath);
    }
    catch (err) {
      this.log.error({err: err}, 'Error loading page schema "' + obj.filepath + '". Is it valid JSON?');
      throw err;
    }

    // create a page with the supplied schema,
    // using the filename as the page name
    var page = Page(obj.name, schema);

    // create a handler for requests to this page
    var control = controller(page, options);

    // add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    this.addComponent({
        key: page.key,
        route: page.route,
        component: control,
        filepath: obj.filepath
    }, reload);
};

Server.prototype.addComponent = function (options, reload) {

    if (!options.route) return;

    if (reload) {
        _.each(options.route.paths, function (path) {
            this.removeComponent(path);
        }, this);
    }

    var self = this;

    _.each(options.route.paths, function (path) {

        // only add a route once
        if (this.components[path]) return;

        this.components[path] = options.component;

        if (path === '/index') {

            this.log.info("Loaded " + path);

            // configure "index" route
            this.app.use('/', function (req, res, next) {
                // map request method to controller method
                var method = req.method && req.method.toLowerCase();

                if (method && options.component[method]) {

                    return options.component[method](req, res, next);
                }
                next();
            });
        }
        else {

            this.log.info("Loaded " + path);

            if (options.route.constraint) this.app.Router.constrain(path, options.route.constraint);

            var self = this;

            this.app.use(path, function (req, res, next) {

                self.app.Router.testConstraint(path, req, res, function (result) {

                    // test returned false, try the next matching route
                    if (!result) return next();

                    // map request method to controller method
                    var method = req.method && req.method.toLowerCase();

                    // if it's a HEAD request, fake it as a GET so that it
                    // continues. The help.sendbackHTML method will be passed
                    // the actual req.method to determine what we send back
                    if (method === 'head') method = 'get';

                    if (method && options.component[method]) {
                      return options.component[method](req, res, next);
                    }

                    // no matching HTTP method found, try the next matching route
                    if (next) {
                      return next();
                    }
                    else {
                      return help.sendBackJSON(404, res, next)(null, require(options.filepath));
                    }
                });
            });
        }
    }, this);
};

Server.prototype.removeComponent = function (route) {
    this.app.unuse(route);
    delete this.components[route];
};

Server.prototype.getComponent = function (key) {
  return _.find(this.components, function (component) {
    return component.page.key === key;
  });
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

Server.prototype.dustCompile = function (options) {

    var pagePath = options.pagePath;
    var templatePath = options.pagePath;
    var partialPath = options.partialPath;

    var self = this;

    // reset the dust cache so
    // templates can be reloaded
    dust.cache = {};

    _.each(self.components, function(component) {
        try {
            var filepath = path.join(templatePath, component.page.template);
            var template =  fs.readFileSync(filepath, "utf8");
            var name = component.page.template.slice(0, component.page.template.indexOf('.'));
            var compiled = dust.compile(template, name, true);
            dust.loadSource(compiled);
        }
        catch (e) {
            var message = '\nCouldn\'t compile Dust template at "' + filepath + '". ' + e + '\n';
            console.log(message);
            throw e;
        }
    });

    // load templates in the template folder that haven't already been loaded
    var templates = fs.readdirSync(templatePath);
    templates.map(function (file) {
        return path.join(templatePath, file);
    }).filter(function (file) {
        return path.extname(file) === '.dust';
    }).forEach(function (file) {

        var pageTemplateName = path.basename(file, '.dust');

        if (!_.find(_.keys(dust.cache), function (k) { return k.indexOf(pageTemplateName) > -1; })) {

            self.log.info("Template not found in cache, loading '%s' (%s)", pageTemplateName, file);

            var template =  fs.readFileSync(file, "utf8");

            try {
                var compiled = dust.compile(template, pageTemplateName, true);
                dust.loadSource(compiled);
            }
            catch (e) {
                var message = '\nCouldn\'t compile Dust template "' + pageTemplateName + '". ' + e + '\n';
                console.log(message);
                throw e;
            }
        }
    });

    var partials = fs.readdirSync(partialPath);
    partials.forEach(function (partial) {
        //Load the template from file
        var name = partial.slice(0, partial.indexOf('.'));
        var template =  fs.readFileSync(path.join(partialPath, partial), "utf8");

        try {
            var compiled = dust.compile(template, "partials/" + name, true);
            dust.loadSource(compiled);
        }
        catch (e) {
            var message = '\nCouldn\'t compile Dust partial at "' + path.join(partialPath, partial) + '". ' + e + '\n';
            console.log(message);
            throw e;
        }
    });

    // handle templates that are requested but not found in the cache
    dust.onLoad = function(templateName, opts, callback) {
      // `templateName` is the name of the template requested by dust.render / dust.stream
      // or via a partial include, like {> "hello-world" /}
      fs.readFile(options.workspacePath + '/' + templateName + '.dust', { encoding: 'utf8' }, function (err, data) {
        if (err) {
          self.log.error(err);
          console.log(err);
        }

        callback(null, data);
      });
    };
}

Server.prototype.getSessionStore = function(sessionConfig) {
  var env = config.get('env');
  if (/development|test/.exec(env) === null) {
    if (sessionConfig.store === '') {
      var message = '';
      message += 'It is not recommended to use an in-memory session store in the ' + env + ' environment. Please change the configuration to one of the following:\n\n';

      sessionConfig.store = 'mongodb://username:password@host/databaseName';
      message += 'MongoDB:\n'.green;
      message += JSON.stringify(sessionConfig, null, 2);
      message += '\n\n';

      sessionConfig.store = '<redis_server_host>:<redis_server_port>';
      message += 'Redis\n'.green;
      message += JSON.stringify(sessionConfig, null, 2);
      message += '\n\n';

      sessionConfig.store = '';

      throw new Error(message);
    }

    //app.set('trust proxy', 1) // trust first proxy
    //sess.cookie.secure = true // serve secure cookies
  }

  if (sessionConfig.store === '') {
    return null;
  }

  if (sessionConfig.store.indexOf('mongodb') > -1) {
    return new mongoStore({
		  url: sessionConfig.store
    });
  }
  else if (sessionConfig.store.indexOf(':') > 0) {
    // redis
  }
}

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function (options, done) {
    var self = this;

    // create workspace directories if they don't exist
    // permissions default to 0777
    var idx = 0;
    _.each(options, function(dir) {
      mkdirp(dir, {}, function (err, made) {
        if (err) {
          self.log.error(err);
          console.log(err);
        }

        if (made) {
          self.log.info('Created directory ' + made);
          console.log('Created directory ' + made);
        }

        idx++;

        if (idx === Object.keys(options).length) return done();
      });
    });
};

/**
 *  Expose VERB type methods for adding routes and middlewares
 *
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
                };
            };

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

function onConnection(socket) {
  // set a timeout for the client connection
  socket.setTimeout(config.get('server.socketTimeoutSec') * 1000);
  socket.on('timeout', function() {
    socket.end();
  });
}

function onListening(e) {

  // check that our API connection is valid
  help.isApiAvailable(function(err, result) {

    if (err) {
      console.log(err);
      console.log();
      process.exit(0);
    }

    var env = config.get('env');

    // var webMessage = "Started DADI Web '" + config.get('app.name') + "' (" + version + ", Node.JS v" + nodeVersion + ", " + env + " mode) on " + config.get('server.host') + ":" + config.get('server.port');
    // var apiMessage = "";

    // if (config.get('api.enabled') === true) {
    //   apiMessage += "Attached to DADI API on " + config.get('api.host') + ":" + config.get('api.port');
    // }

    var startText = '';
    startText += '  ----------------------------\n';
    startText += '  ' + config.get('app.name').green + '\n';
    startText += '  Started \'DADI Web\'\n';
    startText += '  ----------------------------\n';
    startText += '  Server:      '.green + config.get('server.host') + ':' + config.get('server.port') + '\n';
    startText += '  Version:     '.green + version + '\n';
    startText += '  Node.JS:     '.green + nodeVersion + '\n';
    startText += '  Environment: '.green + env + '\n';
    if (config.get('api.enabled') === true) {
    startText += '  API:         '.green + config.get('api.host') + ":" + config.get('api.port') + '\n';
    }
    else {
    startText += '  API:         '.green + 'Not found'.red + '\n';
    }
    startText += '  ----------------------------\n';
    console.log(startText);

    // console.log("\n" + webMessage.bold.white);
    // console.log(apiMessage.bold.blue + "\n");
  });
}

function onError(err) {
  if (err.code == 'EADDRINUSE') {
    var message =  'Can\'t connect to local address, is something already listening on port ' + config.get('server.port') + '?';
    err.localIp = config.get('server.host');
    err.localPort = config.get('server.port');
    err.message = message;
    console.log(err);
    console.log();
    process.exit(0);
  }
}
