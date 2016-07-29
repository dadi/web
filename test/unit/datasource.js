var should = require('should');
var sinon = require('sinon');
var page = require(__dirname + '/../../dadi/lib/page');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../../dadi/lib/log');
var config = require(__dirname + '/../../config.js');

describe('Datasource', function (done) {
  it('should export constructor', function (done) {
    datasource.Datasource.should.be.Function;
    done();
  });

  it('should export a `loadDatasource()` function', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    datasource(p, dsName, help.getPathOptions(), function() {}).loadDatasource.should.be.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    datasource.should.be.Function;
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    datasource(p, dsName, help.getPathOptions(), function() {}).should.be.an.instanceOf(datasource.Datasource);
    done();
  });

  // if (self.source.type === 'static') {
  //   callback(self);
  // }

  // self.authStrategy = self.setAuthStrategy();

  it('should attach the datasource `schema` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var ds = datasource(p, dsName, options, function() {});

    ds.schema.should.eql(help.getSchemaFromFile(options.datasourcePath, dsName, null));

    done();
  });

  it('should attach `source` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var ds = datasource(p, dsName, options, function() {});

    ds.source.should.eql(help.getSchemaFromFile(options.datasourcePath, dsName, null).datasource.source);

    done();
  });

  it('should attach default `requestParams` to datasource if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var ds = datasource(p, dsName, options, function() {} );

    ds.requestParams.should.eql([]);

    datasource.Datasource.prototype.loadDatasource.restore();
    done();
  });

  it('should attach `requestParams` to datasource if specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();

    var ds = datasource(p, dsName, options, function() {} );

    ds.requestParams[0].param.should.eql("make");

    done();
  });

  it('should attach default `chained` property to datasource if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'chained');

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var ds = datasource(p, dsName, options, function() {} );

    should.not.exist(ds.chained);

    datasource.Datasource.prototype.loadDatasource.restore();
    done();
  });

  it('should attach `chained` property to datasource if specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();

    var ds = datasource(p, dsName, options, function() {} );

    should.exist(ds.chained);
    ds.chained.datasource.should.eql('global');

    done();
  });

  it('should be no `authStrategy` attached to datasource if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'auth');

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var ds = datasource(p, dsName, options, function() {} );

    should.not.exist(ds.authStrategy);

    datasource.Datasource.prototype.loadDatasource.restore();
    done();
  });

  it('should attach `authStrategy` to datasource if specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();

    var ds = datasource(p, dsName, options, function() {} );

    should.exist(ds.authStrategy);
    ds.authStrategy.config.type.should.eql('bearer');

    done();
  });

  it('should build an endpoint string from schema properties', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';

    datasource(p, dsName, help.getPathOptions(), function(err, ds) {
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
      done();
    });

  });

  it('should use the `skip` property when building an endpoint string', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';

    var req = { params: {}, url: '/1.0/cars/makes' };

    var ds = datasource(p, dsName, help.getPathOptions(), function() {});
    ds.schema.datasource.skip = 5;

    ds.processRequest(dsName, req);
    ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&skip=5&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');

    done();
  });

  it('should build an endpoint string from schema properties when no page is specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var dsName = 'car-makes';

    datasource(name, dsName, help.getPathOptions(), function(err, ds) {
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
      done();
    });
  });

  it('should use main config api settings if no host specified', function(done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var dsName = 'car-makes';

    config.set('api.host', 'api.example.com');
    config.set('api.port', 80);

    var ds = datasource(name, dsName, help.getPathOptions(), function() {});
    delete ds.schema.datasource.source.host;
    //delete ds.schema.datasource.source.port;
    ds.buildEndpoint(ds.schema, function() {});
    ds.endpoint.should.eql('http://api.example.com:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
    done();
  });

  it('should use main config api settings if no port specified', function(done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var dsName = 'car-makes';

    config.set('api.host', 'api.example.com');
    config.set('api.port', 80);

    var ds = datasource(name, dsName, help.getPathOptions(), function() {});
    delete ds.schema.datasource.source.port;
    ds.buildEndpoint(ds.schema, function() {});
    ds.endpoint.should.eql('http://127.0.0.1:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
    done();
  });

  it('should use main config api settings if no host or port specified', function(done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var dsName = 'car-makes';

    config.set('api.host', 'api.example.com');
    config.set('api.port', 80);

    var ds = datasource(name, dsName, help.getPathOptions(), function() {});
    delete ds.schema.datasource.source.host;
    delete ds.schema.datasource.source.port;
    ds.buildEndpoint(ds.schema, function() {});
    ds.endpoint.should.eql('http://api.example.com:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
    done();
  });

  it('should attach specified `options` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    datasource(p, dsName, help.getPathOptions(), function() {}).options.datasourcePath.should.exist;
    done();
  });

  it('should attach specified `filterEvent` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName);
    dsSchema.datasource.filterEvent = "testFilterEvent"

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var ds = datasource(p, dsName, options, function() {} );

    datasource.Datasource.prototype.loadDatasource.restore();

    ds.filterEvent.should.exist;
    (typeof ds.filterEvent).should.eql('object');
    ds.filterEvent.name.should.eql('testFilterEvent');
    done();
  });

  it('should attach null `filterEvent` when not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    (datasource(p, dsName, help.getPathOptions(), function() {}).filterEvent === null).should.eql(true);
    done();
  });

  it('should log an error if the specified datasource file can\'t be found', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'carzzz';

    var method = sinon.spy(log, 'error');

    datasource(p, dsName, help.getPathOptions(), function() {})

    method.called.should.be.true;

    log.error.restore();

    //should.throws(function() { datasource(p, dsName, help.getPathOptions(), function() {}) }, Error);

    done();
  });

  it('should load the referenced datasource file from the filesystem', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, '');

    var ds = datasource(p, dsName, options, function() {} );

    ds.schema.should.eql(dsSchema);

    done();
  });

  describe('processDatasourceParameters', function(done) {
    it('should process sort parameter when it is an array', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();

      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');
      dsSchema.datasource.sort = [{field: "name", order: "asc"}]
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      var ds = datasource(p, dsName, options, function() {} );

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var endpoint = ds.processDatasourceParameters(dsSchema, req.url)

      datasource.Datasource.prototype.loadDatasource.restore();

      endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should process sort parameter when it is an array with many items', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();

      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');
      dsSchema.datasource.sort = [{field: "name", order: "asc"},{field: "age", order: "desc"}]
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      var ds = datasource(p, dsName, options, function() {} );

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var endpoint = ds.processDatasourceParameters(dsSchema, req.url)

      datasource.Datasource.prototype.loadDatasource.restore();

      endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}');

      done();
    });

    it('should process sort parameter when it is an object', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();

      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');
      dsSchema.datasource.sort = {field: "name", order: "asc"}
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      var ds = datasource(p, dsName, options, function() {} );

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var endpoint = ds.processDatasourceParameters(dsSchema, req.url)

      datasource.Datasource.prototype.loadDatasource.restore();

      endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should process sort parameter when it is a MongoDB-style object', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();

      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');
      dsSchema.datasource.sort = {"name": 1}
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      var ds = datasource(p, dsName, options, function() {} );

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var endpoint = ds.processDatasourceParameters(dsSchema, req.url)

      datasource.Datasource.prototype.loadDatasource.restore();

      endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should process sort parameter when it is a MongoDB-style object with many items', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();

      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams');
      dsSchema.datasource.sort = {"name": 1, "age": -1}
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      var ds = datasource(p, dsName, options, function() {} );

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var endpoint = ds.processDatasourceParameters(dsSchema, req.url)

      datasource.Datasource.prototype.loadDatasource.restore();

      endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}');

      done();
    });
  })

  describe('processRequest', function(done) {
    it('should add requestParams to the endpoint', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';

      var params = { "make": "bmw" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should use specified type when adding requestParams to the endpoint', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      var p = page(name, schema);
      var dsName = 'car-makes';
      var options = help.getPathOptions();
      var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName);
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      // add type
      dsSchema.datasource.requestParams[0].type = 'Number'

      var params = { "make": "1337" };
      var req = { params: params, url: '/1.0/cars/makes' };

      var ds = datasource(p, dsName, options, function() {});

      datasource.Datasource.prototype.loadDatasource.restore();

      ds.processRequest(dsName, req);

      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":1337}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should pass cache param to the endpoint', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = true;
      var p = page(name, schema);
      var dsName = 'car-makes';

      var params = { "make": "bmw", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes?cache=false' };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false');

      ds.schema.datasource.cache.should.eql(false);

      done();
    });

    it('should remove cache setting from ds schema if not passed in the query', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = true;
      var p = page(name, schema);
      var dsName = 'car-makes';

      var params = { "make": "bmw", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes?cache=false' };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false');
      ds.schema.datasource.cache.should.eql(false);

      var req = { params: params, url: '/1.0/cars/makes' };
      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');
      (typeof ds.schema.datasource.cache === 'undefined').should.eql(true);

      done();
    });

    it('should pass page param to the endpoint when page.passFilters is true', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = true;
      var p = page(name, schema);
      var dsName = 'car-makes';

      var params = { "make": "bmw", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes' };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should pass page param to the endpoint when the datasource matches the page name', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = false;
      var p = page(name, schema);
      var dsName = 'test-cars-ds';

      var params = { "make": "bmw", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes' };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should pass page param to each datasource', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = true;
      var p = page(name, schema);

      var params = { "make": "bmw", "model": "i3", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes' };

      var ds1 = datasource(p, 'car-makes', help.getPathOptions(), function() {});
      var ds2 = datasource(p, 'car-models', help.getPathOptions(), function() {});

      ds1.processRequest('car-makes', req);
      ds2.processRequest('car-models', req);

      ds2.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/models?count=20&page=3&filter={"name":"i3"}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });

    it('should pass filter param to the endpoint', function (done) {
      var name = 'test';
      var schema = help.getPageSchema();
      schema.settings.passFilters = true;
      var p = page(name, schema);
      var dsName = 'car-makes';

      var filter = JSON.stringify( { "model": "x3" } );
      var params = { "make": "bmw", "page": 3 };
      var req = { params: params, url: '/1.0/cars/makes?filter=' + filter };

      var ds = datasource(p, dsName, help.getPathOptions(), function() {});

      ds.processRequest(dsName, req);
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"model":"x3","name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');

      done();
    });
  });

  it('should pass referer header to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.settings.passFilters = true;
    var p = page(name, schema);

    var params = { "make": "bmw", "model": "i3", "page": 3 };
    var req = { params: params, url: '/1.0/cars/makes', headers: {'referer': 'http://www.example.com'} };

    var ds1 = datasource(p, 'car-makes', help.getPathOptions(), function() {});

    ds1.processRequest('car-makes', req);

    ds1.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&referer=' + encodeURIComponent('http://www.example.com') + '&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');

    done();
  });
});
