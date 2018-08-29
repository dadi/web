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
    var dsName = 'car_makes'
    new Datasource(p, dsName, TestHelper.getPathOptions()).loadDatasource.should
      .be.Function
    done()
  })

  it('should export function that returns an instance', function (done) {
    Datasource.should.be.Function
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    new Datasource(
      p,
      dsName,
      TestHelper.getPathOptions()
    ).should.be.an.instanceOf(Datasource.Datasource)
    done()
  })

  it('should attach the datasource `schema` to datasource', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    new Datasource(p, dsName, options).init(function (err, ds) {
      if (err) done(err)
      var fsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, null)
      ds.schema.datasource.key.should.eql(fsSchema.datasource.key)
      done()
    })    
  })

  it('should attach `source` to datasource', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    new Datasource(p, dsName, options).init(function (err, ds) {
      if (err) done(err)
      var fsSchema = TestHelper.getSchemaFromFile(options.datasourcePath, dsName, null)
      
      ds.source.endpoint.should.eql(fsSchema.datasource.source.endpoint)
      ds.source.host.should.eql(fsSchema.datasource.source.host)
      ds.source.port.should.eql(fsSchema.datasource.source.port)
      ds.source.protocol.should.eql(fsSchema.datasource.source.protocol)
      ds.source.type.should.eql(fsSchema.datasource.source.type)
      
      done()
    })
  })

  it('should attach default `requestParams` to datasource if not specified', function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/datasource']
    Datasource = require(__dirname + '/../../dadi/lib/datasource')

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(
      options.datasourcePath,
      dsName,
      'requestParams'
    )

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

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
    var dsName = 'car_makes'
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
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(
      options.datasourcePath,
      dsName,
      'chained'
    )

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

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
    var dsName = 'car_makes'
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
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(
      options.datasourcePath,
      dsName,
      'auth'
    )

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

    new Datasource(p, dsName, options).init(function (err, ds) {
      should.not.exist(ds.authStrategy)
      Datasource.Datasource.prototype.loadDatasource.restore()
      done()
    })
  })

  it('should build an endpoint string from schema properties', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )
      done()
    })
  })

  it('should use the `skip` property when building an endpoint string', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'

    var req = { params: {}, url: '/1.0/cars/makes' }

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ds.schema.datasource.skip = 5
      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://127.0.0.1:3000/1.0/cars/makes?count=20&skip=5&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )
      done()
    })
  })

  it('should build an endpoint string from schema properties when no page is specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car_makes'

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )
      done()
    })
  })

  it('should use main config api settings if no host specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car_makes_nosource'

    config.set('api.host', 'api.example.com')

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      if (err) done(err)
  
      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://api.example.com:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )
      
      done()
    })    
  })

  it('should use main config api settings if no port specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car_makes_nosource'

    config.set('api.port', 80)

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      if (err) done(err)

      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://127.0.0.1:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )

      done()
    })
  })

  it('should use main config api settings if no host or port specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var dsName = 'car_makes_nosource'

    config.set('api.host', 'api.example.com')
    config.set('api.port', 80)

    new Datasource(null, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
     
      ds.provider.buildEndpoint()
      ds.provider.endpoint.should.eql(
        'http://api.example.com:80/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      )
      done()
    })
  })

  it('should attach specified `options` to datasource', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ds.options.datasourcePath.should.exist
      done()
    })
  })

  it('should attach specified `endpointEvent` to datasource', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var dsSchema = TestHelper.getSchemaFromFile(
      TestHelper.getPathOptions().datasourcePath,
      dsName
    )
    dsSchema.datasource.endpointEvent = 'testEndpointEvent'

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      Datasource.Datasource.prototype.loadDatasource.restore()
      ds.endpointEvent.should.exist
      ;(typeof ds.endpointEvent).should.eql('object')
      ds.endpointEvent.name.should.eql('testEndpointEvent')
      done()
    })
  })

  it('should attach null `endpointEvent` when not specified', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ;(ds.endpointEvent === null).should.eql(true)
      done()
    })
  })

  it('should attach specified `filterEvent` to datasource', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var dsSchema = TestHelper.getSchemaFromFile(
      TestHelper.getPathOptions().datasourcePath,
      dsName
    )
    dsSchema.datasource.filterEvent = 'testFilterEvent'

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
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
    var dsName = 'car_makes'

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
      err,
      ds
    ) {
      ;(ds.filterEvent === null).should.eql(true)
      done()
    })
  })

  it('should load the referenced datasource file from the filesystem', function (done) {
    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var p = page(name, schema)
    var dsName = 'car_makes'
    var options = TestHelper.getPathOptions()
    var dsSchema = TestHelper.getSchemaFromFile(
      options.datasourcePath,
      dsName,
      ''
    )

    new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (err, ds) {
      if (err) done(err)
      ds.schema.should.exist
      done()
    })
  })

  describe('processDatasourceParameters', function (done) {
    it('should process sort parameter when it is an array', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName,
        'requestParams'
      )
      dsSchema.datasource.sort = [{ field: 'name', order: 'asc' }]
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        var params = { make: 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        decodeURIComponent(
          require('url').parse(ds.provider.endpoint).path
        ).should.eql(
          '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should process sort parameter when it is an array with many items', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName,
        'requestParams'
      )
      dsSchema.datasource.sort = [
        { field: 'name', order: 'asc' },
        { field: 'age', order: 'desc' }
      ]
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        var params = { make: 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        decodeURIComponent(
          require('url').parse(ds.provider.endpoint).path
        ).should.eql(
          '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}'
        )
        done()
      })
    })

    it('should process sort parameter when it is an object', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName,
        'requestParams'
      )
      dsSchema.datasource.sort = { field: 'name', order: 'asc' }
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { make: 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()

        decodeURIComponent(
          require('url').parse(ds.provider.endpoint).path
        ).should.eql(
          '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should process sort parameter when it is a MongoDB-style object', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName,
        'requestParams'
      )
      dsSchema.datasource.sort = { name: 1 }
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { make: 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        ds.provider.processDatasourceParameters(dsSchema, req.url)

        Datasource.Datasource.prototype.loadDatasource.restore()
        decodeURIComponent(
          require('url').parse(ds.provider.endpoint).path
        ).should.eql(
          '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should process sort parameter when it is a MongoDB-style object with many items', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()

      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName,
        'requestParams'
      )
      dsSchema.datasource.sort = { name: 1, age: -1 }
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      new Datasource(p, dsName, options).init(function (err, ds) {
        var params = { make: 'bmw' }
        var req = { params: params, url: '/1.0/cars/makes' }
        ds.provider.processDatasourceParameters(dsSchema, req.url)
        Datasource.Datasource.prototype.loadDatasource.restore()
        decodeURIComponent(
          require('url').parse(ds.provider.endpoint).path
        ).should.eql(
          '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1,"age":-1}'
        )
        done()
      })
    })
  })

  describe('processRequest', function (done) {
    it('should add requestParams to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'

      var params = { make: 'bmw' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should use specified type when adding requestParams to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'Number'

      var params = { make: '1337' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":1337}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should use requestParams to replace placeholders in the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )

      // modify the endpoint to give it a placeholder
      dsSchema.datasource.source.endpoint = '1.0/makes/{name}'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'String'
      dsSchema.datasource.requestParams[0].target = 'endpoint'

      var params = { make: 'ford' }
      var req = { params: params, url: '/1.0/makes/ford' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/makes/ford?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should use requestParams to replace multiple placeholders in the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )

      // modify the endpoint to give it a placeholder
      dsSchema.datasource.source.endpoint = '1.0/makes/{name}/{edition}'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'String'
      dsSchema.datasource.requestParams[0].target = 'endpoint'

      dsSchema.datasource.requestParams.push({
        type: 'Number',
        param: 'edition',
        field: 'edition',
        target: 'endpoint'
      })

      var params = { make: 'ford', edition: 2 }
      var req = { params: params, url: '/1.0/makes/ford/2' }

      new Datasource(p, dsName, options).init((err, ds) => {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/makes/ford/2?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should get requestParams specified in config to populate placeholders in the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )

      // modify the endpoint to give it a placeholder
      dsSchema.datasource.source.endpoint = '1.0/makes/{name}/{edition}'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      // set a config value
      config.set('global.vehicles', { make: 'ford', edition: 2 })

      // add source
      dsSchema.datasource.requestParams[0].type = 'String'
      dsSchema.datasource.requestParams[0].source = 'config'
      dsSchema.datasource.requestParams[0].param = 'global.vehicles.make'
      dsSchema.datasource.requestParams[0].target = 'endpoint'

      dsSchema.datasource.requestParams.push({
        type: 'Number',
        source: 'config',
        param: 'global.vehicles.edition',
        field: 'edition',
        target: 'endpoint'
      })

      var params = { make: 'xxx', edition: 0 } // these should not be used
      var req = { params: params, url: '/1.0/makes/ford/2' }

      new Datasource(p, dsName, options).init((err, ds) => {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        config.set('global.vehicles', {})
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/makes/ford/2?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should use page from requestParams when constructing the endpoint', function (done) {
      var name = 'car_makes'
      var schema = TestHelper.getPageSchema()
      var p = page(name, schema)
      var dsName = 'car_makes'
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )
      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      // add type
      dsSchema.datasource.requestParams[0].type = 'Number'

      // add page
      dsSchema.datasource.requestParams.push({
        param: 'page',
        queryParam: 'page'
      })

      var params = { make: '1337', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes/3' }

      new Datasource(p, dsName, options).init(function (err, ds) {
        Datasource.Datasource.prototype.loadDatasource.restore()
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":1337}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should pass cache param to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car_makes'

      var params = { make: 'bmw', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes?cache=false' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false'
        )
        // ds.schema.datasource.cache.should.eql(false)
        done()
      })
    })

    it('should remove cache setting from ds schema if not passed in the query', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car_makes'

      var params = { make: 'bmw', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes?cache=false' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}&cache=false'
        )
        // ds.schema.datasource.cache.should.eql(false)

        req = { params: params, url: '/1.0/cars/makes' }
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )

        // ;(typeof ds.schema.datasource.cache === 'undefined').should.eql(true)

        done()
      })
    })

    it('should pass page param to the endpoint when page.passFilters is true', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car_makes'

      var params = { make: 'bmw', page: '3' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init((err, ds) => {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should pass page param = 1 to the endpoint when page is not numeric', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car_makes'

      var params = { make: 'bmw', page: 'x' }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init((err, ds) => {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should pass page param to the endpoint when the datasource matches the page name', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = false
      var p = page(name, schema)
      var dsName = 'test-cars-ds'

      var params = { make: 'bmw', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
        done()
      })
    })

    it('should pass page param to each datasource', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)

      var params = { make: 'bmw', model: 'i3', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes' }

      new Datasource(p, 'car_makes', TestHelper.getPathOptions()).init(function (err, ds1) {
        if (err) done(err)
        ds1.processRequest('car_makes', req)

        new Datasource(p, 'car_models', TestHelper.getPathOptions()).init(
          function (err, ds2) {
            ds2.processRequest('car_models', req)
            ds2.provider.endpoint.should.eql(
              'http://8.8.8.8:3000/1.0/cars/models?count=20&page=3&filter={"name":"i3"}&fields={"name":1,"_id":0}&sort={"name":1}'
            )
            done()
          }
        )
      })
    })

    it('should pass filter param to the endpoint', function (done) {
      var name = 'test'
      var schema = TestHelper.getPageSchema()
      schema.settings.passFilters = true
      var p = page(name, schema)
      var dsName = 'car_makes'

      var filter = JSON.stringify({ model: 'x3' })
      var params = { make: 'bmw', page: 3 }
      var req = { params: params, url: '/1.0/cars/makes?filter=' + filter }

      new Datasource(p, dsName, TestHelper.getPathOptions()).init(function (
        err,
        ds
      ) {
        ds.processRequest(dsName, req)
        ds.provider.endpoint.should.eql(
          'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&filter={"model":"x3","name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}'
        )
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
  //   new Datasource(p, 'car_makes', TestHelper.getPathOptions()).init(function (err, ds1) {
  //     ds1.processRequest('car_makes', req)
  //     ds1.provider.endpoint.should.eql('http://127.0.0.1:3000/1.0/cars/makes?count=20&page=3&referer=' + encodeURIComponent('http://www.example.com') + '&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1}')
  //     done()
  //   })
  // })
})
