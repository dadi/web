var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var should = require('should');
var pathToRegexp = require('path-to-regexp');
var _ = require('underscore');
var page = require(__dirname + '/../../dadi/lib/page');
var view = require(__dirname + '/../../dadi/lib/view');
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config.js');

describe('View', function (done) {
  it('should export constructor', function (done) {
    view.View.should.be.Function;
    done();
  });

  it('should attach params to View', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, false);

    v.url.should.eql('/test');
    v.json.should.eql(false);
    v.page.name.should.eql('test');
    done();
  });

  it('should attach specified `template`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.template = 'test.dust';

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, false);

    v.pageTemplate.should.eql('test');
    done();
  });

  it('should accept data via `setData()`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.template = 'test.dust';

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, false);

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

    v.setData(data);

    v.data.title.should.eql('Sir');
    done();
  });

  it('should throw an error if the template is null when calling `render()`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.template = 'testxxxxx.dust';

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, false);

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

    v.setData(data);

    //v.render();

    should.throws(function() { v.render(function() {}); }, Error);
    done();
  });

  it('should return json when calling `render()`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.template = 'test.dust';

    // load a template
    var template = '{#names}{title} {name}{~n}{/names}';
    var compiled = dust.compile(template, 'test', true);
    dust.loadSource(compiled);

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, true);

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

    v.setData(data);

    v.render(function(err, result) {
      result.should.eql(data);
      done();
    });

  });

  it('should return html when calling `render()`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.template = 'test.dust';

    // load a template
    var template = '{#names}{title} {name}{~n}{/names}';
    var compiled = dust.compile(template, 'test', true);
    dust.loadSource(compiled);

    var req = {
      url: '/test'
    };

    var p = page(name, schema);
    var v = view(req.url, p, false);

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

    v.setData(data);

    v.render(function(err, result) {
      var expected = "Sir Moe\nSir Larry\nSir Curly\n";
      result.should.eql(expected);
      done();
    });

  });

});
