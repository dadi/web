var fs = require('fs');
var path = require('path');
var url = require('url');
var util = require('util');
var crypto = require('crypto');
var should = require('should');
var sinon = require('sinon');
var redis = require('redis');

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var datasourceCache = require(__dirname + '/../../dadi/lib/cache/datasource');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config.js');
var cache = require(__dirname + '/../../dadi/lib/cache');

describe('Datasource Cache', function (done) {

  var configStub, server, name, schema, p, dsName, options, ds, cachepath;

  beforeEach(function(done) {
    name = 'test';
    schema = help.getPageSchema();
    p = page(name, schema);
    dsName = 'car-makes';
    options = help.getPathOptions();
    ds = datasource(p, dsName, options, function() {});

    server = sinon.mock(Server);
    server.object.app = api();

    done();
  });

  afterEach(function(done) {

    try {
      if (cachepath) fs.unlinkSync(cachepath);
    }
    catch (err) {

    }

    cache.reset();
    done();
  });

  describe('Module', function (done) {

    it('should be a function', function (done) {
      datasourceCache.should.be.Function;
      done();
    });

    it('should reference the main cache module', function (done) {

      var c = cache(server.object);
      var dsCache = new datasourceCache(ds);
      dsCache.cache.should.eql(c);

      done();

      //console.log(dsCache);
    });

    it('should cache if the app\'s config settings allow', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);

      dsCache.cache.enabled.should.eql(true);

      done();
    });

    it('should not cache if the app\'s config settings don\'t allow', function (done) {

      config.set('caching.directory.enabled', false);
      config.set('caching.redis.enabled', false);

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);
      dsCache.cache.enabled.should.eql(false);

      done();
    });

    it('should use main cache settings if the datasource doesn\'t provide any directory options', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.directory.path', '/Users');
      config.set('caching.directory.extension', 'cache');
      config.set('caching.redis.enabled', false);

      delete ds.schema.datasource.caching.directory;

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);

      dsCache.cachepath.indexOf('/Users').should.be.above(-1);

      done();
    });

    it('should reference main module\'s redis client if configured', function (done) {

      config.set('caching.directory.enabled', false);
      config.set('caching.redis.enabled', true);

      var c = cache(server.object);
      var dsCache = new datasourceCache(ds);

      dsCache.cache.redisClient.should.not.be.null;
      dsCache.cache.redisClient.address.should.eql(config.get('caching.redis.host') + ":" + config.get('caching.redis.port'));

      done();
    });
  });

  describe('cachingEnabled', function (done) {

    it('should not cache if the datasources config settings don\'t allow', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = false;

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);
      dsCache.cachingEnabled().should.eql(false);
      done();
    });

    it('should not cache if the datasource endpoint has ?cache=false', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;

      ds.endpoint += '&cache=false';

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);
      dsCache.cachingEnabled().should.eql(false);
      done();
    });

    it('should cache if the datasources config settings allow', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);

      var dsCache = new datasourceCache(ds);
      dsCache.cachingEnabled().should.eql(true);
      done();
    });

  });

  describe('getFromCache', function (done) {

    it('should read data from a file', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);

      // create a file
      var filename = crypto.createHash('sha1').update(ds.endpoint).digest('hex');
      cachepath = path.join(ds.schema.datasource.caching.directory, filename + '.' + ds.schema.datasource.caching.extension);
      var expected = 'ds content from filesystem';

      fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function(err) {
        if (err) console.log(err.toString());

        var dsCache = new datasourceCache(ds);

        dsCache.getFromCache(function(data){
            data.should.eql(expected);
            done();
        });

      });

    });

    it('should return false if cache file is not found', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);

      // create a file
      var filename = crypto.createHash('sha1').update(ds.endpoint).digest('hex');
      cachepath = path.join(ds.schema.datasource.caching.directory, filename + '_XX.' + ds.schema.datasource.caching.extension);
      var expected = 'ds content from filesystem';

      fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function(err) {
        if (err) console.log(err.toString());

        var dsCache = new datasourceCache(ds);

        dsCache.getFromCache(function(data){
            data.should.eql(false);
            done();
        });

      });

    });

    it('should return false if cache key not in redis store', function (done) {

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);
      var data = 'ds content from filesystem';

      var redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});

      redisClient.set = function set(key, chunk, done) {
      };

      redisClient.append = function append(key, chunk, done) {
        chunk.toString().should.eql(data);
      };

      redisClient.exists = function(filename, cb) {
        cb(null, 0);
      };

      c.redisClient = redisClient;

      var dsCache = new datasourceCache(ds);

      dsCache.getFromCache(function(data){
          data.should.eql(false);
          done();
      });
    });

    it('should return data from redis cache key');//, function (done) {

      // WARNING, FLIMSY TEST

    //   config.set('caching.directory.enabled', false);
    //   config.set('caching.redis.enabled', true);
    //
    //   ds.schema.datasource.caching.enabled = true;
    //
    //   var redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
    //
    //   redisClient.set = function set(key, chunk, done) {
    //   };
    //
    //   redisClient.append = function append(key, chunk, done) {
    //     chunk.toString().should.eql(data);
    //   };
    //
    //   redisClient.exists = function(filename, cb) {
    //     cb(null, 1);
    //   };
    //
    //   var c = cache(server.object);
    //   var data = 'ds content from filesystem';
    //   var expected = 'ds content from filesystem';
    //
    //   c.redisClient = redisClient;
    //
    //   var dsCache = new datasourceCache(ds);
    //
    //   dsCache.cacheResponse(data, function() {
    //     setTimeout(function() {
    //       dsCache.getFromCache(function(data){
    //         console.log(data);
    //         data.should.eql(expected);
    //         //done();
    //       });
    //     }, 500);
    //   });
    //
    // });

    it('should return false if cache file ttl has expired', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;
      ds.schema.datasource.caching.ttl = 1;

      var c = cache(server.object);

      // create a file
      var filename = crypto.createHash('sha1').update(ds.endpoint).digest('hex');
      cachepath = path.join(ds.schema.datasource.caching.directory, filename + '.' + ds.schema.datasource.caching.extension);
      var expected = 'ds content from filesystem';

      fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function(err) {
        if (err) console.log(err.toString());

        setTimeout(function() {

          var dsCache = new datasourceCache(ds);

          dsCache.getFromCache(function(data){
              data.should.eql(false);
              done();
          });

        }, 1500);

      });

    });
  });

  describe('cacheResponse', function (done) {

    it('should write data to a file', function (done) {

      config.set('caching.directory.enabled', true);
      config.set('caching.redis.enabled', false);

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);

      // create a file
      var filename = crypto.createHash('sha1').update(ds.endpoint).digest('hex');
      cachepath = path.join(ds.schema.datasource.caching.directory, filename + '.' + ds.schema.datasource.caching.extension);

      var data = 'ds content from filesystem';
      var dsCache = new datasourceCache(ds);

      dsCache.cacheResponse(data, function() {
        fs.readFile(cachepath, function(err, content) {
          content.toString().should.eql(data);
          done();
        });
      });

    });

    it('should write to a redis client if configured', function(done) {

      ds.schema.datasource.caching.enabled = true;

      var c = cache(server.object);
      var data = 'ds content from filesystem';

      var redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});

      redisClient.set = function set(key, chunk, done) {
      };

      redisClient.append = function append(key, chunk, done) {
        chunk.toString().should.eql(data);
      };

      c.redisClient = redisClient;

      var dsCache = new datasourceCache(ds);

      dsCache.cacheResponse(data, function() {
          done();
      });
    });
  });

});
