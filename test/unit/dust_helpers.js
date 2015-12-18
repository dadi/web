var should = require('should');
var dust = require('dustjs-linkedin');
var Server = require(__dirname + '/../../dadi/lib');
var api = require(__dirname + '/../../dadi/lib/api');
var page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');

describe('Dust Helpers', function (done) {

  // @Truncate
  it('truncate: should truncate specified data with the specified length', function (done) {

    var source = "{@Truncate data=\"plain text\" length=\"5\"/}";
    var expected = "plain";

    dust.renderSource(source, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @Truncate
  it('truncate: should truncate specified data with the specified length and add ellipsis', function (done) {

    var source = "{@Truncate data=\"plain text\" length=\"5\" ellipsis=\"true\"/}";
    var expected = "plain&hellip;";

    dust.renderSource(source, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @Truncate
  it('truncate: should truncate specified data with the specified length and add ellipsis false', function (done) {

    var source = "{@Truncate data=\"plain text\" length=\"5\" ellipsis=\"false\"/}";
    var expected = "plain";

    dust.renderSource(source, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @Trim
  // Usage: {@Trim data="{body}"/}
  it('trim: should trim whitespace from specified data', function (done) {

    var source = "{@Trim data=\"plain text    \"/}";
    var expected = "plain text";

    dust.renderSource(source, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @formatDate
  // Usage: {@formatDate data="{body}" [unix="{lastModifiedAt}"] format="YYYY-MM-DDTh:mm:ss+01:00"/}
  it('formatDate: should format specified data as date');//, function (done) {
  //
  //   var source = "{@formatDate data=\"{body}\" unix=\"{lastModifiedAt}\" format=\"YYYY-MM-DDTh:mm:ss+01:00\"/}";
  //   var expected = "plain text";
  //
  //   dust.renderSource(source, {}, function (err, out) {
  //     if (err) done(err);
  //     out.should.eql(expected);
  //     done();
  //   });
  // });

  // @markdown
  it('markdown: should format as html', function (done) {

    var source = "Here is a paragraph"
    var tmpl = "{@markdown}" + source + "{/markdown}";
    var expected = "<p>Here is a paragraph</p>\n";

    dust.renderSource(tmpl, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @soberMarkdown
  it('markdown: should format as html without <p> wrappers', function (done) {

    var source = "Here is a paragraph"
    var tmpl = "{@soberMarkdown}" + source + "{/soberMarkdown}";
    var expected = "Here is a paragraph\n";

    dust.renderSource(tmpl, {}, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @forceRender
  //* Usage: {@forceRender str="{body}" value="{vartoreplace}" /}
  it('forceRender: should evaluate passed parameters', function (done) {

    var body = "Hello World, I mean {...}";
    var tmpl = "{@forceRender str=\"" + body + "\" value=\"" + "{person}" + "\"/}";
    var expected = "Hello World, I mean Dave";

    //console.log(tmpl)

    dust.renderSource(tmpl, { person: "Dave" }, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @htmlstrip
  it('htmlstrip: should remove html from content', function (done) {

    var tmpl = "{@htmlstrip}<p>Hello</p>{/htmlstrip}";

    var expected = "Hello";

    dust.renderSource(tmpl, {  }, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @iter
  // * {@iter items=arrayOfItems from=0 to=12}
  // *   run for each item, with the item as context
  // * {/iter}
  describe('iterator', function (done) {
    it('should loop through items', function (done) {

      var tmpl = "{@iter items=nums from=0 }{@markdown}{.}{/markdown}{/iter}";
      var expected = '<h1 id="1">1</h1>\n<h1 id="2">2</h1>\n<h1 id="3">3</h1>\n';

      dust.renderSource(tmpl, { nums: ['# 1', '# 2', '# 3'] }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should loop through items in reverse', function (done) {

      var tmpl = "{@iter items=nums from=3 to=0 }{@markdown}{.}{/markdown}{/iter}";
      var expected = '<h1 id="3">3</h1>\n<h1 id="2">2</h1>\n<h1 id="1">1</h1>\n';

      dust.renderSource(tmpl, { nums: ['# 1', '# 2', '# 3'] }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });
  });

  // @plural
  describe("plural", function(done) {
    it('should return singular term', function (done) {

      var tmpl = "{@plural val=\"1\" auto=\"book\" /}";
      var expected = "book";

      dust.renderSource(tmpl, {  }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should return pluralized term', function (done) {

      var tmpl = "{@plural val=\"5\" auto=\"book\" /}";
      var expected = "books";

      dust.renderSource(tmpl, {   }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should return singular term given overrides', function (done) {

      var tmpl = "{@plural val=\"1\" one=\"book\" many=\"books\" /}";
      var expected = "book";

      dust.renderSource(tmpl, {   }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should return pluralized term given overrides', function (done) {

      var tmpl = "{@plural val=\"5\" one=\"book\" many=\"books\" /}";
      var expected = "books";

      dust.renderSource(tmpl, {   }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });
  });

  // @numberCommas
  it('numberCommas: should format number with commas', function (done) {

    var tmpl = "{@numberCommas}1024{/numberCommas}";

    var expected = "1,024";

    dust.renderSource(tmpl, {  }, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  // @url
  describe('url', function (done) {
    it('should return generated url for specified page path', function (done) {

      Server.app = api();
      Server.components = {};

      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);

      Server.addComponent({
          key: p.key,
          route: p.route,
          component: { page: p }
      }, false);

      var tmpl = "{@url page=\"test\" make=\"bmw\" model=\"1-series\"/}";

      var expected = "/car-reviews/bmw/1-series";

      dust.renderSource(tmpl, {  }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should throw an error if no page is specifed', function (done) {

      Server.app = api();
      Server.components = {};

      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);

      Server.addComponent({
          key: p.key,
          route: p.route,
          component: { page: p }
      }, false);

      var tmpl = "{@url make=\"bmw\" model=\"1-series\"/}";
      should.throws(function() { dust.renderSource(tmpl, {  }, {}) }, Error ),
      done();
    });

    it('should throw an error if an unknown page is specifed', function (done) {

      Server.app = api();
      Server.components = {};

      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);

      Server.addComponent({
          key: p.key,
          route: p.route,
          component: { page: p }
      }, false);

      var tmpl = "{@url page=\"xxx\" make=\"bmw\" model=\"1-series\"/}";
      should.throws(function() { dust.renderSource(tmpl, {  }, {}) }, Error ),
      done();
    });
  })

  // @slugify
  // {@slugify}{title}{/slugify}
  it('slugify: should slugify data', function (done) {

    var body = "Hello World";
    var tmpl = "{@slugify}" + body + "{/slugify}";
    var expected = "hello-world";


    dust.renderSource(tmpl, {  }, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

});
