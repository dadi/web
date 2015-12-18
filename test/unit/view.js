var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var commonDustHelpers = require('common-dustjs-helpers');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var should = require('should');
var pathToRegexp = require('path-to-regexp');
var _ = require('underscore');
var page = require(__dirname + '/../../dadi/lib/page');
var view = require(__dirname + '/../../dadi/lib/view');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config.js');

describe('View', function (done) {
  it('should export constructor', function (done) {
    view.View.should.be.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    view.should.be.Function;

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    view('/', p, false).should.be.an.instanceOf(view.View);
    done();
  });

  it('should attach url to view', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    view('/', p, false).url.should.eql('/');
    done();
  });

  it('should attach page to view', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    view('/', p, false).page.name.should.eql('test');
    done();
  });

  it('should attach json param to view', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    view('/', p, true).json.should.eql(true);
    done();
  });

  it('should attach template name', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.template = 'test.dust';

    view('/', p, true).pageTemplate.should.eql('test');
    done();
  });

  it('should attach null as template if not found in cache', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    (typeof view('/', p, true).template === 'undefined').should.eql(true);
    done();
  });

  it('should accept a data object', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    var v = view('/', p, false);

    var data = {
      page: "test"
    };

    v.setData(data);

    v.data.page.should.eql('test');

    done();
  });

  it('should throw error if no template exists when `render` is called', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    var v = view('/', p, false);

    should.throws(function() { v.render() }, Error);

    done();
  });

  it('should render the data using the page template', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.template = 'test.dust';

    var templateSource = "{#names}{title} {name}{~n}{/names}";
    var compiled = dust.compile(templateSource, 'test', true);
    dust.loadSource(compiled);

    var data = {
      "title": "Sir",
      "names": [{
        "name": "Moe"
      },
      {
        "name": "Larry"
      },
      {
        "name": "Curly"
      }]
    };

    var v = view('/', p, false);

    v.setData(data);

    v.render(function(err, result) {
      result.should.eql("Sir Moe\nSir Larry\nSir Curly\n");
      done();
    });

  });

  it('should return the data if json param is true', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.template = 'test.dust';

    var templateSource = "{#names}{title} {name}{~n}{/names}";
    var compiled = dust.compile(templateSource, 'test', true);
    dust.loadSource(compiled);

    var data = {
      "title": "Sir",
      "names": [{
        "name": "Moe"
      },
      {
        "name": "Larry"
      },
      {
        "name": "Curly"
      }]
    };

    var v = view('/', p, true);

    v.setData(data);

    v.render(function(err, result) {
      result.should.eql(data);
      done();
    });

  });

});
