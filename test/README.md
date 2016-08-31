## Testing DADI Web
---


```js
var TestHelper = require(path.join(__dirname, '/../help'))()
```

```
describe('Test Description', function(done) {

  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  ...
})
```

afterEach(function (done) {
  TestHelper.stopServer(done)
})

var cacheConfig = {
  caching: {
    directory: {
      enabled: true
    }
  }
}

TestHelper.updateConfig(cacheConfig).then(() => {
  var e = cache(server.object).enabled
  e.should.eql(true)
  done()
})