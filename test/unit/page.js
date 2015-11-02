var should = require('should');
var sinon = require('sinon');
var page = require(__dirname + '/../../bantam/lib/page');
var help = require(__dirname + '/help');

describe('Page', function (done) {
  it('should export constructor', function (done) {
    page.Page.should.be.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    page.should.be.Function;
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).should.be.an.instanceOf(page.Page);
    done();
  });

  it('should attach name to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).name.should.eql('test');
    done();
  });

  it('should attach default `route` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.route;
    page(name, schema).route.paths.should.eql( ['/test'] );
    done();
  });

  it('should attach specified `route` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).route.paths.should.eql( ['/car-reviews/:make/:model'] );
    done();
  });

  it('should generate `toPath` method for page path', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );

    p.route.toPath.should.be.a.Function;

    var url = p.route.toPath({ make: 'bmw', model: '2-series'});
    url.should.eql('/car-reviews/bmw/2-series');
    
    done();
  });

  it('should attach default `template` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.template;
    page(name, schema).template.should.eql('test.dust');
    done();
  });

  it('should attach specified `template` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).template.should.eql('car-reviews.dust');
    done();
  });

  it('should attach default `contentType` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.contentType;
    page(name, schema).contentType.should.eql('text/html');
    done();
  });

  it('should attach specified `contentType` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.contentType = 'application/xml'
    page(name, schema).contentType.should.eql('application/xml');
    done();
  });

  it('should attach specified `settings` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.settings.should.exist;
    p.settings.cache.should.exist;
    p.settings.cache.should.be.true;
    done();
  });

  it('should attach specified `datasources` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.datasources.should.exist;
    p.datasources.should.eql(["car-makes"]);
    done();
  });

  it('should attach specified `events` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.events.should.exist;
    p.events.should.eql(["car-reviews"]);
    done();
  });

  it('should throw error if specified `route` is not an object', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.route = "/test";

    should.throws(function() { page(name, schema) }, Error);

    done();
  });

});
