var should = require('should');
var sinon = require('sinon');
var page = require(__dirname + '/../../bantam/lib/page');
var datasource = require(__dirname + '/../../bantam/lib/datasource');
var help = require(__dirname + '/help');

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

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(dsSchema);

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

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(dsSchema);

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

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(dsSchema);

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

  it('should build an endpoint string from schema properties')

  it('should attach specified `options` to datasource', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    datasource(p, dsName, help.getPathOptions(), function() {}).options.datasourcePath.should.exist;
    done();
  });

  it('should throw an error if no `options` are specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'car-makes';
    
    should.throws(function() { datasource(p, dsName, null, function() {}); }, Error);

    done();
  });

  it('should throw an error if the specified datasource file can\'t be found', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    var dsName = 'carzzz';
    
    should.throws(function() { datasource(p, dsName, help.getPathOptions(), function() {}) }, Error);

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

});
