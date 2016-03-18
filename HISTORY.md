
Version 1.2.0 / 2016-03-18

Add: additional routing/rewriting config properties
Add: #37 Global events loader
Fix: #38 replace datasource loader in router
Fix: #36 load events in the order they were specified
Fix: #32 load template from filesystem if Dust cache is_disabled
Fix: #31 define the zlib variable
Fix: #29 refresh endpoint filter on subsequent page loads

Version 1.1.0 / 2016-03-11

### Cache Invalidation
Version 1.1.0 introduces a cache invalidation endpoint which allows an authorised user to flush the cache
for either a specific path or the entire website. This process clears both page and datasource cache files.

The user must send a POST request to `/api/flush` with a request body containing the path to flush and
a set of credentials that match those held in the configuration file:

**Flush all cache files**
```
POST /api/flush HTTP/1.1
Host: www.example.com

{ "path": "*", "clientId": "testClient", "secret": "superSecret" }
```

**Flush cache files for a specific path**
```
POST /api/flush HTTP/1.1
Host: www.example.com

{ "path": "/books/crime", "clientId": "testClient", "secret": "superSecret" }
```

### Datasource Sort property

The sort property in a datasource schema has been extended to allow a variety of styles.
The sort property can now take one of the following forms:

To sort by the field "name" ascending, as an array of field names:
```
"sort": [{ "field": "name", "order": "asc" }]
```

To sort by the field "name" ascending, as a single field name:
```
"sort": { "field": "name", "order": "asc" }
```

To sort by the field "name" ascending, as a MongoDB-style object:
```
"sort": { "name": 1 }
```

To sort by multiple fields, as a MongoDB-style object:
```
"sort": { "name": 1, "age": -1 }
```

### Datasource filter events

A datasource can now specify a `filterEvent` property. Before the datasource attempts to load data
it will load and run an event file matching the `filterEvent` property. Filter events are identical to normal
event files, but they should return a filter object that the datasource will use when querying the API for data.

**Example filter event: /app/events/datasourceFilterTest.js**
```js
// the `data` parameter contains the data already loaded by
// the page's datasources
var Event = function (req, res, data, callback) {
  var filter = { "x": "1" };
  callback(null, filter);
};

module.exports = function (req, res, data, callback) {
  return new Event(req, res, data, callback);
};

module.exports.Event = Event;
```


0.5.0 / 2016-01-08
===================

* Cache:
 - Ensure a more unique datasource cache key by including the datasource name as well as the endpoint
 - Ensure a more unique page cache key by including the query as well as the pathname
 - Improve search for loaded component based on request URL
 - Ensure contentType is passed from loaded component (page) settings when returning cached data

* Config:
 - Remove `sentry.enabled` and rely solely on the existence of the `sentry.dsn` property
 - Rationalise included config properties in sample files, most can be handled by the sensible defaults

* Datasource:
 - Add `skip` property to give the option of specifying an offset when querying for API data
 - Use main config api settings when endpoint host or port are not specified by the datasource schema

* Event:
 - Pass 404 errors from event files to the NotFound handler

* Views:
 - Added new `replace` helper, usage: {@replace str="hello.world" search="." replace="-" /}


0.1.7 / 2015-12-06
===================
* Config:
  - Add config option for socket timeout, defaults to 30 seconds

* Keepalive header added to Serama data & auth requests



0.1.7 / 2015-11-26
===================

* Server:
  - Error if the configured API can't be reached
  - Simplify middleware loading
* Logging:
  - Simplify error logging
  - Provide configuration for logging to a Sentry server
  - Remove Slack logging option, as this can be done from Sentry
* Config:
  - Provide configuration for logging to a Sentry server

0.1.6 / 2015-11-12
===================

  * Cache:
    - Don't cache requests that use ?json=true in the querystring
    - Provides better integration with Express patterns
  * Debug:
    - When debug: true is set in config, a debug panel is added to the right side of the page with
      a view of the loaded data and various execution stats. Note this won't work if your data object contains
      Javascript ads with no CDATA declaration.
  * Logging:
    - Locate client IP in request headers when behind a load balancer
    - Fix logging in default error handler
    - Addition of AWS Kinesis and Slack logging options	(see example files or config.js)
    - Don't log to slack in test mode
  * Config:
    - Add support for serving content from virtual directories (see example files or config.js)
    - Add support for Gzip compression (see example files or config.js)
    - Add support for configurable cache control headers (see example files or config.js)
    - Add application name (see example files or config.js)
  * Pages:
    - Extend `toPath` method to cover all routes in a page
    - Addition of new getComponent method on the Server to return a page by key
  * Datasources:
    - Remove json param from query before building filter
  * Tests
    - improve test suite coverage
    - ensure test environment is set before tests run
  * Misc:
    - rename public to sample-public to avoid overwrite when updating
    - check page file extension when reloading to avoid processing swap files
