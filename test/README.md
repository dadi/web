## Testing DADI Web


### Include the test helper

```js
var TestHelper = require(path.join(__dirname, '/../help'))()
```

### Test Structure
```js
describe('Test Description', function(done) {
  beforeEach(function(done) {
    done()
  })

  afterEach(function(done) {
    done()
  })

  it('should do something special') // a pending test

  it('should do something else', function(done) {
    // test something
    done()
  })
})
```

### Reset Configuration

```js
beforeEach(function(done) {
  TestHelper.resetConfig().then(() => {
    done()
  })
})
```

### Start the server, for sending "real" requests

```js
var pages = TestHelper.setUpPages()

TestHelper.startServer(pages).then(() => {
  var client = request(connectionString)
  client
  .get('/test')
  .end(function (err, res) {
    res.statusCode.should.eql(200)
    done()
  })
})
```

### Cleaning up

```js
afterEach(function (done) {
  TestHelper.stopServer(done)
})
```

### Setting configuration values

```js
var cacheConfig = {
  caching: {
    directory: {
      enabled: true
    }
  }
}

TestHelper.updateConfig(cacheConfig).then(() => {
  // test something
  done()
})
```