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

  // @replace
  // {@replace str="{message}" search="." replace="-" /}
  it('replace: should replace all instances of search string with the replacement', function (done) {

    var tmpl = "{@replace str=\"Hello World, nice day\" search=\" \" replace=\"X\"/}";
    var expected = "HelloXWorld,XniceXday";


    dust.renderSource(tmpl, {  }, function (err, out) {
      if (err) done(err);
      out.should.eql(expected);
      done();
    });
  });

  describe('findWhere', function(done) {
    it('should return the first matching item', function(done) {

      var list = [{id: 'one', body: 'The First'}, {id: 'two', body: 'The Second'}, {id: 'three', body: 'The Third'}];
      var id = 'two';
      var tmpl = '{@findWhere list=list key="id" value=id}{body}{/findWhere}';
      var expected = "The Second";

      dust.renderSource(tmpl, { list: list, id: id  }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should return the first matching item using multiple properties', function(done) {

      var list = [{id: 2, body: 'one'}, {id: 2, body: 'two'}, {id: 3, body: 'three'}];
      var tmpl = "Hello, {@findWhere list=list props=\"{'id':2, 'body':'two'}\"}{body}{/findWhere}";
      var expected = "Hello, two";

      dust.renderSource(tmpl, { list: list }, function (err, out) {
        if (err) done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should error if not enough params supplied', function(done) {

      var list = [{id: 'one', body: 'The First'}, {id: 'two', body: 'The Second'}, {id: 'three', body: 'The Third'}];
      var id = 'two';
      var tmpl = '{@findWhere list=list key="id"}{body}{/findWhere}';
      var expected = "The Second";

      should.throws(function() { dust.renderSource(tmpl, { list: list, id: id  }, {}); }, Error );

      done();
    });
  });

  describe('paginate', function(done) {

    it('should return empty block if not enough params supplied', function(done) {

      var tmpl = '<ul>';
      tmpl += '{@paginate page=page totalPages=totalPages path="{pathNoPage}/{n}"}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:current}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:prev}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">Prev</a></li>{:else}<li><a href="{path}/">Prev</a></li>{/eq}{!';
      tmpl += '!}{:next}{!';
      tmpl += '	!}<li><a href="{path}/">Next</a></li>{!';
      tmpl += '!}{/paginate}';
      tmpl += '</ul>';

      dust.renderSource(tmpl, { page: 1  }, function(err, out) {
        out.should.eql('<ul></ul>');
        done();
      });
    });

    it('should return empty block if page params are invalid', function(done) {

      var tmpl = '<ul>';
      tmpl += '{@paginate page=page totalPages=totalPages path="{pathNoPage}/{n}"}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:current}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:prev}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">Prev</a></li>{:else}<li><a href="{path}/">Prev</a></li>{/eq}{!';
      tmpl += '!}{:next}{!';
      tmpl += '	!}<li><a href="{path}/">Next</a></li>{!';
      tmpl += '!}{/paginate}';
      tmpl += '</ul>';

      //should.throws(function() { dust.renderSource(tmpl, { page: -1, totalPages: 3, pathNoPage: '/articles'  }, {}); }, Error );
      dust.renderSource(tmpl, { page: 'a', totalPages: 3, pathNoPage: '/articles'  }, function(err, out) {
        out.should.eql('<ul></ul>');
        done();
      });
    });

    it('should render a pagination block', function(done) {
      var tmpl = '<ul>';
      tmpl += '{@paginate page=page totalPages=totalPages path="{pathNoPage}/{n}"}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:current}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">{n}</a></li>{:else}<li><a href="{path}/">{n}</a></li>{/eq}{!';
      tmpl += '!}{:prev}{!';
      tmpl += '	!}{@eq key="{n}" value="1"}<li><a href="{path}">Prev</a></li>{:else}<li><a href="{path}/">Prev</a></li>{/eq}{!';
      tmpl += '!}{:next}{!';
      tmpl += '	!}<li><a href="{path}/">Next</a></li>{!';
      tmpl += '!}{/paginate}';
      tmpl += '</ul>';

      var expected = '<ul><li><a href="/articles/">1</a></li><li><a href="/articles/2/">2</a></li><li><a href="/articles/3/">3</a></li><li><a href="/articles/2/">Next</a></li></ul>';

      dust.renderSource(tmpl, { page: 1, totalPages: 3, pathNoPage: '/articles'  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should render blocks in the right order', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root"}';
      tmpl += '. ~ ';
      tmpl += '{:current}Current ~ ';
      tmpl += '{:prev}Prev ~ ';
      tmpl += '{:next}Next ~ ';
      tmpl += '{:else}Else ~ ';
      tmpl += '{/paginate}';

      var expected = 'Prev ~ . ~ . ~ Current ~ . ~ . ~ Next ~ ';

      dust.renderSource(tmpl, { page: 3, totalPages: 5  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should render only the else block when there is only one page', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root"}';
      tmpl += '{path} ~ ';
      tmpl += '{:current}Current ~ ';
      tmpl += '{:prev}Prev ~ ';
      tmpl += '{:next}Next ~ ';
      tmpl += '{:else}Else ~ ';
      tmpl += '{/paginate}';

      var expected = 'Else ~ ';

      dust.renderSource(tmpl, { page: 1, totalPages: 1  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should not render the else block when there are multiple pages', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root"}';
      tmpl += 'Step ~ ';
      tmpl += '{:else}Else ~ ';
      tmpl += '{/paginate}';

      var expected = 'Step ~ ';

      dust.renderSource(tmpl, { page: 1, totalPages: 2  }, function (err, out) {
        if (err) return done(err);
        out.should.equal(expected);
        done();
      });
    });

    it('should only render current if it is the only block', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root/{n}"}';
      tmpl += '{:current}{path}';
      tmpl += '{/paginate}';

      var expected = '/root/2';

      dust.renderSource(tmpl, { page: 2, totalPages: 3  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should handle trailing slashes', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root/{n}/"}';
      tmpl += 'Step: {path} ~ ';
      tmpl += '{:current}Current: {path} ~ ';
      tmpl += '{/paginate}';

      var expected = 'Step: /root/ ~ Current: /root/2/ ~ Step: /root/3/ ~ ';

      dust.renderSource(tmpl, { page: 2, totalPages: 3  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should render correct paths when using a query param', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root" param="page"}';
      tmpl += '{path} ~ ';
      tmpl += '{:current}Current: {path} ~ ';
      tmpl += '{/paginate}';

      var expected = '/root ~ Current: /root?page=2 ~ /root?page=3 ~ ';

      dust.renderSource(tmpl, { page: 2, totalPages: 3  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should render correct paths when using a query param and existing searchstring', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root?one=1&two=three" param="page"}';
      tmpl += '{path|s} ~ ';
      tmpl += '{:current}Current: {path|s} ~ ';
      tmpl += '{/paginate}';

      var expected = '/root?one=1&two=three ~ Current: /root?one=1&two=three&page=2 ~ /root?one=1&two=three&page=3 ~ ';

      dust.renderSource(tmpl, { page: 2, totalPages: 3  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

    it('should render correct paths when using a query param which is already in the searchstring', function(done) {
      var tmpl = '{@paginate page=page totalPages=totalPages path="/root?one=1&two=three" param="page"}';
      tmpl += '{:current}Current: {path|s} ~ ';
      tmpl += '{:prev}Prev: {path|s} ~ ';
      tmpl += '{:next}Next: {path|s} ~ ';
      tmpl += '{/paginate}';

      var expected = 'Prev: /root?one=1&two=three ~ Current: /root?one=1&two=three&page=2 ~ Next: /root?one=1&two=three&page=3 ~ ';

      dust.renderSource(tmpl, { page: 2, totalPages: 3  }, function (err, out) {
        if (err) return done(err);
        out.should.eql(expected);
        done();
      });
    });

  });
});
