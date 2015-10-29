var pkginfo = require('pkginfo').read(__dirname);
var colors = require('colors');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var controller = require(__dirname + '/controller');
var router = require(__dirname + '/controller/router');
var page = require(__dirname + '/page');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var log = require(__dirname + '/log');
var help = require(__dirname + '/help');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var dustHelpersExtension = require(__dirname + '/dust/helpers.js');
var serveStatic = require('serve-static')
var serveFavicon = require('serve-favicon');
var toobusy = require('toobusy-js');
var moment = require('moment');

var config = require(path.resolve(__dirname + '/../../config.js'));

var Server = function () {
    this.components = {};
    this.monitors = {};

    this.log = log.get().child({module: 'server'});
    this.log.info('Server logging started.')
};

Server.prototype.start = function (options, done) {
    var self = this;

    this.readyState = 2;
    options || (options = {});

    // create app
    var app = this.app = api();

    // override config
    if (options.configPath)
        config.loadFile(options.configPath);

    // add necessary middlewares in order below here...

    // serve static files (css,js,fonts)
    app.use(serveFavicon((options.publicPath || __dirname + '/../../public') + '/favicon.ico'));
    app.use(serveStatic(options.mediaPath || 'media', { 'index': false }));
    app.use(serveStatic(options.publicPath || 'public' , { 'index': false }));

    app.use(bodyParser.json());
    app.use(bodyParser.text());

    // request logging middleware
    app.use(function (req, res, next) {
        var start = Date.now();
        var _end = res.end;
        res.end = function () {
            var duration = Date.now() - start;

            log.access(
              (req.connection.remoteAddress || '')
              + ' -'
              + ' ' + moment().format()
              + ' ' + req.method + ' ' + req.url + ' ' + 'HTTP/' + req.httpVersion
              + ' ' + res.statusCode
              + ' ' + res._headers['content-length']
              + (req.headers["referer"] ? (' ' + req.headers["referer"]) : '')
              + ' ' + req.headers["user-agent"]
            );

            // log the request method and url, and the duration
            log.info({module: 'router'}, req.method
                + ' ' + req.url
                + ' ' + res.statusCode
                + ' ' + duration + 'ms');

            _end.apply(res, arguments);
        };
        next();
    });

    // caching layer
    cache(self).init();

    // authentication layer
    auth(self);

    // handle routing & redirects
    router(self, options);

    // start listening
    var server = this.server = app.listen(config.get('server.port'), config.get('server.host'));

    server.on('listening', function (e) {

      var env = config.get('env');
      var rosecombMessage = "[BANTAM] Started Rosecomb (" + pkginfo.package.version + ", " + env + " mode) on " + config.get('server.host') + ":" + config.get('server.port');
      var seramaMessage = "[BANTAM] Attached to Serama API on " + config.get('api.host') + ":" + config.get('api.port');

      console.log("\n" + rosecombMessage.bold.white);
      console.log(seramaMessage.bold.blue + "\n");

      if (env === 'production') {
        self.log.info(rosecombMessage);
        self.log.info(seramaMessage);
      }

    });

    server.on('error', function (e) {
      if (e.code == 'EADDRINUSE') {
        self.log.error('Error ' + e.code + ': Address ' + config.get('server.host') + ':' + config.get('server.port') + ' is already in use, is something else listening on port ' + config.get('server.port') + '?\n\n');
        process.exit(0);
      }
    });

    // load app specific routes
    this.loadApi(options);

    // dust configuration
    dust.isDebug = config.get('dust.debug');
    dust.debugLevel = config.get('dust.debugLevel');
    dust.config.cache = config.get('dust.cache');
    dust.config.whitespace = config.get('dust.whitespace');


    this.readyState = 1;

    process.on('SIGINT', function() {
      server.close();
      toobusy.shutdown();
      self.log.info('Server stopped, process exiting.');
      process.exit();
    });

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

    var routesPath = this.routesPath = options.routesPath || __dirname + '/../../workspace/routes';

    options.datasourcePath = datasourcePath;
    options.pagePath = pagePath;
    options.partialPath = partialPath;
    options.eventPath = eventPath;
    options.routesPath = routesPath;

    self.ensureDirectories(options, function(text) {

        // load routes
        self.updatePages(pagePath, options, false);

        // compile all dust templates
        self.dustCompile(options);

        self.addMonitor(datasourcePath, function (dsFile) {
            self.updatePages(pagePath, options, true);
        });

        self.addMonitor(eventPath, function (eventFile) {
            self.updatePages(pagePath, options, true);
        });

        self.addMonitor(pagePath, function (pageFile) {
            self.updatePages(pagePath, options);
            self.dustCompile(options);
        });

        self.addMonitor(partialPath, function (partialFile) {
            self.dustCompile(options);
        });

        self.addMonitor(routesPath, function (file) {
            if (self.app.Router) {
                self.app.Router.loadRewrites(options, function() {
                    self.app.Router.loadRewriteModule();
                });
            }
        });

        self.log.info('Load complete.');

    });

};

Server.prototype.updatePages = function (directoryPath, options, reload) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var pages = fs.readdirSync(directoryPath);

    pages.forEach(function (page) {
        if (page.indexOf('.json') < 0) return;

        // parse the url out of the directory structure
        var pageFilepath = path.join(directoryPath, page);

        // file should be json file containing schema
        var name = page.slice(0, page.indexOf('.'));

      self.addRoute({
        name: name,
        filepath: pageFilepath
      }, options, reload);

    });
};

Server.prototype.addRoute = function (obj, options, reload) {

    // get the page schema
    try {
      var schema = require(obj.filepath);
    }
    catch (err) {
      this.log.error({err: err}, 'Error loading page schema "' + obj.filepath + '". Is it valid JSON?');
    }

    // With each page we create a controller, that acts as a component of the REST api.
    // We then add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    var p = page(obj.name, schema);

    var control = controller(p, options);

    this.addComponent({
        route: p.route,
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

    // // only add a route once
    // if (this.components[options.route.path]) return;

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

                    if (method && options.component[method]) {
                        return options.component[method](req, res, next);
                    }

                    // no matching HTTP method found, try the next matching route
                    return next();
                });
            });
        }
    }, this);

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

Server.prototype.dustCompile = function (options) {

    var self = this;
    var pagePath = options.pagePath;
    var templatePath = options.pagePath;
    var partialPath = options.partialPath;

    var self = this;

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
            self.log.info(message);
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

            self.log.info("template %s (%s) not found in cache, loading source...", pageTemplateName, file);

            var template =  fs.readFileSync(file, "utf8");

            try {
                var compiled = dust.compile(template, pageTemplateName, true);
                dust.loadSource(compiled);
            }
            catch (e) {
                var message = '\nCouldn\'t compile Dust template "' + pageTemplateName + '". ' + e + '\n';
                self.log.info(message);
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
            self.log.info(message);
        }
    });
};

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
    var idx = 0;
    _.each(options, function(dir) {
        //if (!fs.existsSync(dir)) {
            mkdirp(dir, {}, function (err, made) {

                if (err) {
                    self.log.error(err);
                }

                if (made) {
                    self.log.info('Created workspace directory ' + made);
                }

                idx++;

                if (idx === Object.keys(options).length) return done();
            });
        // }
        // else {
        //     idx++;
        // }

        //if (idx === Object.keys(options).length) return done('done');
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
