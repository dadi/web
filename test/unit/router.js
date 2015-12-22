var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var should = require('should');
var _ = require('underscore');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var Router = require(__dirname + '/../../dadi/lib/controller/router');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');

function cleanupPath(path, done) {
  try {
    fs.unlink(path, function() {
      done();
    });
  }
  catch (err) {
    console.log(err);
  }
}

var constraintsPath = __dirname + '/../app/routes/constraints.js';

describe('Router', function (done) {

  beforeEach(function(done) {
    // write a temporary constraints file
    var constraints = "";
    constraints += "module.exports.getCategories = function (req, res, callback) {  \n";
    constraints += "  return callback(false);\n";
    constraints += "};\n";

    fs.writeFileSync(constraintsPath, constraints);

    done();
  });

  afterEach(function(done) {
    // remove temporary constraints file
    cleanupPath(constraintsPath, function() {
      done();
    });
  });

  // it('should export function that allows adding components', function (done) {
  //   Server.addComponent.should.be.Function;
  //   done();
  // });
  //
  // it('should export function that allows getting components', function (done) {
  //   Server.getComponent.should.be.Function;
  //   done();
  // });

  it('should attach to the provided server instance', function (done) {
    Server.app = api();
    var server = Server;

    Router(server, {});
    server.app.Router.should.exist;

    done();
  });


  it('should assign null to handlers if no js file found', function (done) {

    Server.app = api();
    var server = Server;

    Router(server, {});

    server.app.Router.handlers.should.eql([]);

    done();
  });

  it('should assign handlers if js file found', function (done) {

    Server.app = api();
    var server = Server;

    Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

    server.app.Router.handlers['getCategories'].should.exist;

    done();
  });

  describe('Add Constraint', function(done) {
    it('should add a constraint if the provided route specifies a constraint handler', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      server.app.Router.constraints['/test'].should.exist;

      done();
    });

    it('should throw error if the provided route specifies a missing constraint handler', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'XXX';
      var page = Page('test', schema);

      should.throws(function() { server.app.Router.constrain(page.route.paths[0], page.route.constraint); }, Error);

      done();
    });
  });

  describe('Test Constraint', function(done) {
    it('should return true if the route does not have a constraint', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      var page = Page('test', schema);

      var req = {}, res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(true);
        done();
      });

    });

    it('should return false if the route constraint returns false', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test' }, res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(false);
        done();
      });

    });

    it('should return true if the route constraint is a datasource returning data', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = {
        results: [
          { "_id": 1, "name": "Cat 1" }
        ]
      };

      sinon.stub(libHelp, 'getData').yields(null, JSON.stringify(data));
      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(true);

        libHelp.getData.restore();

        done();
      });

    });

    it('should return false if the route constraint is a datasource returning nothing', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = {
        results: []
      };

      sinon.stub(libHelp, 'getData').yields(null, JSON.stringify(data));
      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(false);

        libHelp.getData.restore();

        done();
      });
    });

    it('should return false if the route constraint is a datasource returning nonsense', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = help.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = "{0";

      sinon.stub(libHelp, 'getData').yields(null, data);
      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(false);

        libHelp.getData.restore();

        done();
      });
    });
  });

})
