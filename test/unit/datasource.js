var should = require('should');
var sinon = require('sinon');
var page = require(__dirname + '/../../bantam/lib/page');
var datasource = require(__dirname + '/../../bantam/lib/datasource');
var help = require(__dirname + '/help');
var log = require(__dirname + '/../../bantam/lib/log');

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

  it('should build an endpoint string from schema properties when no page is specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var dsName = 'car-makes';
    
    datasource(name, dsName, help.getPathOptions(), function(err, ds) {
      ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}');
      done();
    });
    
  });

  it('should attach specified `options` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    datasource(p, dsName, help.getPathOptions(), function() {}).options.datasourcePath.should.exist;
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

  it('should add requestParams to the endpoint', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';

    var params = { "make": "bmw" };
    var req = { params: params, url: '/1.0/cars/makes' };
    
    var ds = datasource(p, dsName, help.getPathOptions(), function() {});    
      
    ds.processRequest(name, req);
    ds.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}');
      
    done();
    
  });

});
