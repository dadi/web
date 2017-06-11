var path = require('path')
var should = require('should')
var sinon = require('sinon')

var page = require(__dirname + '/../../dadi/lib/page')
var Datasource = require(__dirname + '/../../dadi/lib/datasource')
var TestHelper = require(__dirname + '/../help')()
var config = require(path.resolve(path.join(__dirname, '/../../config')))

describe('Datasource', function (done) {
  before(function (done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it('should export constructor', function (done) {
    Datasource.Datasource.should.be.Function
    done()
  })

  it('should export a `loadDatasource()` function', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    new Datasource(p, dsName, TestHelper.getPathOptions()).loadDatasource.should.be.Function
    done()
  })

  it('should export function that returns an instance', function (done) {
    Datasource.should.be.Function
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    new Datasource(p, dsName, TestHelper.getPathOptions()).should.be.an.instanceOf(Datasource.Datasource)
    done()
  })

  // if (self.source.type === 'static') {
  //   callback(self)
  // }

  // self.authStrategy = self.setAuthStrategy()

  it('should attach the datasource `schema` to datasource', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    new Datasource(p, dsName, options).init(function (err, ds) {
      ds.schema.should.eql(TestHelper.getSchemaFromFile(options.datasourcePath, dsName, null))
    })

    done()
  })

  it('should attach `source` to datasource', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    new Datasource(p, dsName, options).init(function (err, ds) {
      ds.source.should.eql(TestHelper.getSchemaFromFile(options.datasourcePath, dsName, null).datasource.source)
      done()
    })
  })

  it('should attach default `requestParams` to datasource if not specified', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')

    sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

    new Datasource(p, dsName, options).init(function (err, ds) {
      ds.requestParams.should.eql([])

      Datasource.Datasource.prototype.loadDatasource.restore()
      done()
    })
  })

  it('should attach `requestParams` to datasource if specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()

    new Datasource(p, dsName, options).init(function (err, ds) {
      ds.requestParams[0].param.should.eql('make')
      done()
    })
  })

  it('should attach default `chained` property to datasource if not specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'chained')

    sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

    new Datasource(p, dsName, options).init(function (err, ds) {
      should.not.exist(ds.chained)
      Datasource.Datasource.prototype.loadDatasource.restore()
      done()
    })
  })

  it('should attach `chained` property to datasource if specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()

    new Datasource(p, dsName, options).init(function (err, ds) {
      should.exist(ds.chained)
      ds.chained.datasource.should.eql('global')
      done()
    })
  })

  it('should be no `authStrategy` attached to datasource if not specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'auth')

    sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

    new Datasource(p, dsName, options).init(function (err, ds) {
      should.not.exist(ds.authStrategy)
      Datasource.Datasource.prototype.loadDatasource.restore()
      done()
    })
  })

  it('should attach `authStrategy` to datasource if specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()

    new Datasource(p, dsName, options).init(function (err, ds) {
      should.exist(ds.provider.authStrategy)
      ds.provider.authStrategy.config.type.should.eql('bearer')
      done()
    })
  })

  it('should build an endpoint string from schema properties', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should use the `skip` property when building an endpoint string', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'

    var req = { params: {}, url: '/1.0/cars/makes' }

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ds.schema.datasource.skip = 5
      ds.processRequest(dsName, req)
      ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&skip=5&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should build an endpoint string from schema properties when no page is specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car-makes'

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should use main config api settings if no host specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car-makes'

    config.set('api.host', 'api.example.com')
    config.set('api.port', 80)

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      delete ds.schema.datasource.source.host
      // delete ds.schema.datasource.source.port
      ds.provider.buildEndpoint(ds.schema, function () {})
      ds.provider.endpoint.should.eql('http://api.example.com:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should use main config api settings if no port specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car-makes'

    config.set('api.host', 'api.example.com')
    config.set('api.port', 80)

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      delete ds.schema.datasource.source.port
      ds.provider.buildEndpoint(ds.schema, function () {})
      ds.provider.endpoint.should.eql('http://127.0.0.1:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should use main config api settings if no host or port specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car-makes'

    config.set('api.host', 'api.example.com')
    config.set('api.port', 80)

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      delete ds.schema.datasource.source.host
      delete ds.schema.datasource.source.port
      ds.provider.buildEndpoint(ds.schema, function () {})
      ds.provider.endpoint.should.eql('http://api.example.com:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
      done()
    })
  })

  it('should attach specified `options` to datasource', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ds.options.datasourcePath.should.exist
      done()
    })
  })

  it('should attach specified `filterEvent` to datasource', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var dsSchema = TestHelper.getSchemaFromFile(TestHelper.getPathOptions().datasourcePath, dsName)
    dsSchema.datasource.filterEvent = 'testFilterEvent'

    sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      Datasource.Datasource.prototype.loadDatasource.restore()
      ds.filterEvent.should.exist
      ;(typeof ds.filterEvent).should.eql('object')
      ds.filterEvent.name.should.eql('testFilterEvent')
      done()
    })
  })

  it('should attach null `filterEvent` when not specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ;(ds.filterEvent === null).should.eql(true)
      done()
    })
  })

  it.skip("should log an error if the specified datasource file can't be found", function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'carzzz'

    var method = sinon.spy(log, 'error')

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      method.called.should.be.true
      log.error.restore()

      // should.throws(function() { datasource(p, dsName, TestHelper.getPathOptions(), function() {}) }, Error)

      done()
    })
  })

  it('should load the referenced datasource file from the filesystem', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car-makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, '')

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      ds.schema.should.eql(dsSchema)
      done()
    })
  })

  describe('processDatasourceParameters', function (done) {
    it('should process sort parameter when it is an array', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')
      dsSchema.datasource.sort = [{field: 'name', order: 'asc'}]
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        var params = { 'make': 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        var endpoint = ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should process sort parameter when it is an array with many items', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')
      dsSchema.datasource.sort = [{field: 'name', order: 'asc'}, {field: 'age', order: 'desc'}]
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        var params = { 'make': 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        var endpoint = ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}')
        done()
      })
    })

    it('should process sort parameter when it is an object', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')
      dsSchema.datasource.sort = {field: 'name', order: 'asc'}
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { 'make': 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        var endpoint = ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()

        endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should process sort parameter when it is a MongoDB-style object', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')
      dsSchema.datasource.sort = {'name': 1}
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { 'make': 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        var endpoint = ds.provider.processDatasourceParameters(dsSchema, req.url)

        Datasource.Datasource.prototype.loadDatasource.restore()
        endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should process sort parameter when it is a MongoDB-style object with many items', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, 'requestParams')
      dsSchema.datasource.sort = {'name': 1, 'age': -1}
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { 'make': 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        var endpoint = ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        endpoint.should.eql('/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}')
        done()
      })
    })
  })

  describe('processRequest', function (done) {
    it('should add requestParams to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'

      var params = { 'make': 'bmw' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should use specified type when adding requestParams to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName)
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'Number'

      var params = { 'make': '1337' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":1337}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should use requestParams to replace placeholders in the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName)

      // modify the endpoint to give it a placeholder
      dsSchema.datasource.source.endpoint = '1.0/makes/{name}'

      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'String'
      dsSchema.datasource.requestParams[0].target = 'endpoint'

      var params = { 'make': 'ford' }
      var req = { params: params, url: '/1.0/makes/ford' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/makes/ford?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should use page from requestParams when constructing the endpoint', function (done) {
      var name = 'car-makes'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car-makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName)
      sinon.stub(Datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'Number'

      // add page
      dsSchema.datasource.requestParams.push({ param: 'page', queryParam: 'page' })

      var params = { 'make': '1337', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes/3' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":1337}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should pass cache param to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car-makes'

      var params = { 'make': 'bmw', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes?cache=false' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false')
        ds.schema.datasource.cache.should.eql(false)
        done()
      })
    })

    it('should remove cache setting from ds schema if not passed in the query', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car-makes'

      var params = { 'make': 'bmw', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes?cache=false' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false')
        ds.schema.datasource.cache.should.eql(false)

        req = { params: params, url: '/1.0/cars/makes' }
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
        ;(typeof ds.schema.datasource.cache === 'undefined').should.eql(true)

        done()
      })
    })

    it('should pass page param to the endpoint when page.passFilters is true', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car-makes'

      var params = { 'make': 'bmw', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should pass page param to the endpoint when the datasource matches the page name', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = false
      var p = page(name, schema)
      var dsName = 'test-cars-ds'

      var params = { 'make': 'bmw', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })

    it('should pass page param to each datasource', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)

      var params = { 'make': 'bmw', 'model': 'i3', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, 'car-makes', TestHelper.getPathOptions()).init(function (err, ds1) {
        ds1.processRequest('car-makes', req)

        new Datasource(p, 'car-models', TestHelper.getPathOptions()).init(function (err, ds2) {
          ds2.processRequest('car-models', req)
          ds2.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/models?count=20&page=3&filter={"name":"i3"}&fields={"name":1,"_id":0}&sort={"name":1}')
          done()
        })
      })
    })

    it('should pass filter param to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car-makes'

      var filter = JSON.stringify({ 'model': 'x3' })
      var params = { 'make': 'bmw', 'page': 3 }
      var req = { params: params, url: '/1.0/cars/makes?filter=' + filter }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"model":"x3","name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
        done()
      })
    })
  })

  // it('should pass referer header to datasource', function (done) {
  //   var name = 'test'
  //   var schema = TestHelper.getPageSchema()
  //   schema.settings.passFilters = true
  //   var p = page(name, schema)
  //
  //   var params = { 'make': 'bmw', 'model': 'i3', 'page': 3 }
  //   var req = { params: params, url: '/1.0/cars/makes', headers: {'referer': 'http://www.example.com'} }
  //
  //   new Datasource(p, 'car-makes', TestHelper.getPathOptions()).init(function (err, ds1) {
  //     ds1.processRequest('car-makes', req)
  //     ds1.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&referer=' + encodeURIComponent('http://www.example.com') + '&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
  //     done()
  //   })
  // })
})
