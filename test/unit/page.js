var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var should = require('should');
var pathToRegexp = require('path-to-regexp');
var _ = require('underscore');
var page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config.js');

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

  it('should attach key using name if not supplied', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).key.should.eql('test');
    done();
  });

  it('should attach key if supplied', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.page.key = 'key!';
    page(name, schema).key.should.eql('key!');
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

  it('should attach specified `route` to page when its a string instead of an array', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();

    delete schema.route.path;
    schema.route.paths = '/car-reviews/:make/:model';

    var p = page(name, schema);
    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );
    done();
  });

  it('should attach specified `route` to page when it is correct in the schema', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();

    delete schema.route.path;
    schema.route.paths = ['/car-reviews/:make/:model'];

    var p = page(name, schema);
    p.route.paths.should.eql(schema.route.paths);
    done();
  });

  it('should attach specified `route constraint` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.route.constraint = 'getCategories';
    page(name, schema).route.constraint.should.eql('getCategories');
    done();
  });

  it('should attach specified `route constraint` to page when the `paths` is a string', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.route.path;
    schema.route.paths = '/car-reviews/:make/:model';
    schema.route.constraint = 'getCategories';
    page(name, schema).route.constraint.should.eql('getCategories');
    done();
  });

  it('should generate `toPath` method for page paths', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );

    p.toPath.should.be.a.Function;

    var url = p.toPath({ make: 'bmw', model: '2-series'});
    url.should.eql('/car-reviews/bmw/2-series');

    done();
  });

  it('should return correct path when using `toPath` method with multiple paths and the first matches', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );
    p.route.paths.push('/car-reviews/:make/:model/review/:subpage');

    var url = p.toPath({ make: 'bmw', model: '2-series'});
    url.should.eql('/car-reviews/bmw/2-series');

    done();
  });

  it('should return correct path when using `toPath` method with multiple paths and the second matches', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );
    p.route.paths.push('/car-reviews/:make/:model/review/:subpage');

    var url = p.toPath({ make: 'bmw', model: '2-series', subpage: 'on-the-road'});
    url.should.eql('/car-reviews/bmw/2-series/review/on-the-road');

    done();
  });

  it('should throw error when using `toPath` method with multiple paths and none match', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );
    p.route.paths.push('/car-reviews/:make/:model/review/:subpage');

    should.throws(function() { p.toPath({ make: 'bmw', yyy: '2-series', xxx: 'on-the-road'}); }, Error);

    done();
  });

  it('should return correct path when using `toPath` method with multiple paths of the same length', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    p.route.paths.should.eql( ['/car-reviews/:make/:model'] );
    p.route.paths.push('/car-reviews/:make/:year');

    var url = p.toPath({ make: 'bmw', year: '2005'});
    url.should.eql('/car-reviews/bmw/2005');

    done();
  });

  it('should be possible to retrieve a page from server components by key', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        name: 'test page',
        key: 'test'
      },
      route: {
        paths: ['/actualUrl']
      },
      settings: {
        cache: true
      }
    };

    var component = _.find(server.object.components, function (component) {
      return component.page.key === "test";
    });

    component.should.not.be.null;
    component.page.key.should.eql('test');

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
    schema.contentType = 'application/xml';
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

  it('should attach empty object when `settings` is not provided', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.settings;
    var p = page(name, schema);
    p.settings.should.eql({});

    done();
  });

  it('should set `beautify` when `settings.beautify` is provided', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.settings.beautify = true;
    var p = page(name, schema);
    p.beautify.should.eql(true);
    done();
  });

  it('should set `passFilters` when `settings.passFilters` is provided', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.settings.passFilters = true;
    var p = page(name, schema);
    p.passFilters.should.eql(true);
    done();
  });

  it('should throw error if `cache` setting is incorrect', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();

    schema.page.cache = schema.settings.cache;
    delete schema.settings.cache;

    should.throws(function() { page(name, schema); }, Error);

    done();
  });

  it('should not throw error if `cache` setting is not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();

    delete schema.settings.cache;

    var p = page(name, schema);

    p.key.should.eql(name);

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

    should.throws(function() { page(name, schema); }, Error);

    done();
  });

  it('should allow finding page by name', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    var found = page(name);
    found.should.equal(p);

    done();
  });

  it('should generate correct url for specific page paths', function (done) {

    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);

    var paths = [];
    paths.push('/buy');
    paths.push('/buy/how-we-do-it');
    paths.push('/buy/testimonials');
    paths.push('/buy/saved-offers');
    paths.push('/buy/choose-by-category/:category?');
    paths.push('/buy/choose-by-make/:make?');
    paths.push('/buy/choose-by-price/:price?');
    paths.push('/buy/choose-model');
    paths.push('/buy/:make/:model/:body');
    paths.push('/buy/configure/:make?/:model?');
    paths.push('/buy/offers/:make/:model/:capId/:postcode?');
    paths.push('/buy/offers/:make/:model/:capId/:offer-id/accept/');
    paths.push('/buy/offers/:make/:model/:capId/:offer-id/details/');
    paths.push('/buy/offers/:make/:model/:capId/:offer-id/options/');
    paths.push('/contact-us');
    paths.push('/map');

    paths.forEach(function (path) {
      p.route.paths = [path];

      var tokens = pathToRegexp.parse(path);
      var parts = {};

      //console.log(tokens);
      tokens.forEach(function (token) {

        if (typeof token === 'object') {
          parts[token.name] = 'whatever';
        }
      });

      //console.log(path)

      var url = p.toPath(parts);
      var expected = pathToRegexp.compile(path)(parts);

      //console.log(url)

      url.should.eql(expected);

    });

    done();
  });

  it('should apply global config `dust.whitespace` as a fallback when no `page.keepWhitespace` is available', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    if (schema.settings.hasOwnProperty('keepWhitespace')) delete schema.settings.keepWhitespace;
    config.set('dust.whitespace', true);

    page(name, schema).keepWhitespace.should.eql(true);

    done();
  });

  it('should prioritise page config `keepWhitespace` param over global config `dust.whitespace`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.settings.keepWhitespace = true;
    config.set('dust.whitespace', false);
    page(name, schema).keepWhitespace.should.eql(true);

    done();
  });

  it('should handle missing page config `keepWhitespace` and global config `dust.whitespace`', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    if (schema.settings.hasOwnProperty('keepWhitespace')) delete schema.settings.keepWhitespace;

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('dust').returns({ cache: true, debug: false, debugLevel: 'INFO'});

    var p = page(name, schema);
    p.keepWhitespace.should.eql(true);

    configStub.restore();

    done();
  });

});
