# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

# [6.1.1] - 2018-11-29

## Changed

* Add property to markdown datasource to specify whether the HTML should be rendered and added to the output. To disable HTML, simply extend the `source` block with a `renderHtml` property:

  ```
   "source": {
      "type": "markdown",
      "path": "./docs",
      "renderHtml": false
    }
  ```



# [6.1.0] - 2018-09-10

## Added

* [#405](https://github.com/dadi/web/issues/405): Multi-language support

## Changed

* [#402](https://github.com/dadi/web/issues/402): Add caching to markdown datasource status: needs tests
* [#416](https://github.com/dadi/web/issues/416): Markdown provider: error when document body contains --- type: bug
* [#428](https://github.com/dadi/web/issues/428): 404 returned for files containing spaces type: bug

# [6.0.1] - 2018-05-30

* [#399](https://github.com/dadi/web/issues/399): improve the process of selecting a loaded endpoint based on the request URL within the cache layer


# [6.0.0] - 2018-04-25

## Debug view

A new debug view has been added to allow developers to understand how a particular page has been generated. In previous versions of Web we've used a configuration setting `allowJsonView` which enabled the option of seeing the data context used to build a rendered page - this could be used on any page by appending `json=true` to the URL.

The new debug view in this version is far more powerful and provides greater insight into how your data is being used within Web. Documentation is available on the [DADI Documentation website](http://docs.dadi.tech/web/latest#debug-view).

## Multiple API support

Version 6.0 removes Web's 1:1 relationship with DADI API, allowing multiple DADI API configurations which can be referenced from a datasource by API name:

**Main configuration**
```json
"api": { 
  "main": {
    "host": "api-one.somedomain.com",
    "port": 80,
    "auth": {
      "tokenUrl": "/token",
      "clientId": "your-client-id",
      "secret": "your-secret"
    }
  },
  "secondary":  {
    "host": "api-two.somedomain.com",
    "port": 80,
    "auth": {
      "tokenUrl": "/token",
      "clientId": "your-client-id",
      "secret": "your-secret"
    }
  }
}
```

**Datasource configuration**
```json
{
  "datasource": {
    "key": "articles",
    "source": {
      "api": "main",
      "endpoint": "1.0/library/articles"
    },
    "count": 12,
    "paginate": false
  }
}
```


## REST API provider 

Version 6.0 removes the `wordpress` and `twitter` data providers, replacing them with a `restapi` provider. Details are available here: https://docs.dadi.tech/web/latest#rest-api. The main difference between the existing `remote` provider and the new `restapi` provider is that `restapi` provider can be supplied with authentication configuration.


## Changed

* [#258](https://github.com/dadi/web/issues/258): give `globalEvents` access to full page data, and run per request instead of only at startup
* [#262](https://github.com/dadi/web/issues/262):  default workspace folders no longer created unnecessarily, even if the config `paths` specified different locations than the default
* [#267](https://github.com/dadi/web/issues/267):  fix Markdown provider crash if data was malformed
* [#336](https://github.com/dadi/web/issues/336): middleware can now intercept public folder requests
* [#350](https://github.com/dadi/web/issues/350):  add support for range header requests on static assets so a browser can specify which part of a file it wants to receieve and when.
* [#370](https://github.com/dadi/web/issues/370): add configuration options for [@dadi/status](https://github.com/dadi/status)
* Deprecated configuration setting for compression removed. `headers.useGzipCompression` was deprecated in Web 4.0 in favour of the more generic `useCompression`.

### Page whitespace configuration

> Note: this is a breaking change

This configuration option has been moved within the page specification file to a block dedicated to the chosen template engine. Modify existing `page.json` files as follows:

**Existing**
```json
"settings": {
  "keepWhitespace": true
}
```

**New**
```json
"settings": {
  "engine": {
    "keepWhitespace": true
  }
}
```

Template engine developers can also use `engine` to pass any page specific setting to their engine.

### Dependency updates

* upgrade to Brotli 1.0 compression engine
* upgrade router to use version 2.0 of [path-to-regexp](https://github.com/pillarjs/path-to-regexp)


# [5.0.1] - 2018-01-13

## Changed

* ensure page parameter passed to datasources is numeric
* include uuid in hashed filename for uniqueness

# [5.0.0] - 2018-01-07

## Added 

* [#170](https://github.com/dadi/web/issues/170): feature: file upload support
* [#253](https://github.com/dadi/web/pull/253): 📬 feature: post processors
* [#297](https://github.com/dadi/web/pull/297): feature: datasource parameter extension 

## Changed

* [#193](https://github.com/dadi/web/issues/193): fix expired token datasource failure
* [#216](https://github.com/dadi/web/issues/216): construct endpoints with chained datasources
* [#288](https://github.com/dadi/web/issues/288): fix required data check fails when given no data
* [#310](https://github.com/dadi/web/pull/310): simplify start page: removes Dust.js and it's dependencies from the Web core. Instead there is a simple start page powered by the ES6 template engine (rather than the previous blog configuration)
* [#312](https://github.com/dadi/web/issues/312): allow Mongo aggregation queries
* fix bug where datasource parameters would be added to a DADI API endpoint when they already exist in the endpoint - leading to incorrect results loaded from the API 


See the full [release notes](https://github.com/dadi/web/releases/tag/v5.0.0).


# [4.0.1] - 2017-09-24

## Changed
* [#238](https://github.com/dadi/web/issues/238): update metadata for Markdown posts after filtering

# [4.0.1] - 2017-09-22

## Changed
* fix: for every datasource request, the DatasourceCache file instantiated a new DadiCache - combining this with Redis caching results in ever-increasing (and unreleased) Redis connections. This change makes use of the primary Cache layer, instantiated once at application startup.

# [4.0.0] - 2017-09-08

See the full [release notes](https://github.com/dadi/web/releases/tag/v4.0.0).

## Added

### Introduce Brotli compression and cache compressed responses

* [#158](http://github.com/dadi/web/issues/158): compress response before caching
* [#174](http://github.com/dadi/web/issues/174): introduce Brotli compression
* Static assets now obey configured compression settings; previously public folder assets were not subject to compression. Files will only be compressed if doing so will save space.

#### Compression configuration

To support the introduction of the new compression engine, the configuration setting for compression has changed. To enable compression in Version 4.0, use `config.headers.useCompression` rather than `config.headers.useGzipCompression`.  The `config.headers.useGzipCompression` property is deprecated and will be removed in a future release.

### Security: CSRF tokens

DADI Web 4.0 adds CSRF security, giving developers the ability to add a per-request CSRF token into the view context, and ensures that all POST requests supply a correct CSRF token. Without a correct token, and with CSRF enabled, users will be greeted with an HTTP 403 response.

To enable CSRF, set the `security.csrf` configuration option:

```json
"security": {
  "csrf": true
}
```

Once enabled, the property `csrfToken` will be added to the view context. You will need to add this to any forms which perform a POST using the field name _csrf, like so:

```html
<form action="/" method="post">
  <input type="text" name="test_input_safe">
  <input type="hidden" name="_csrf" value="{csrfToken}">
  <input type="submit" value="Submit form">
</form>
```

### Application launch

Launching the application now returns a Promise which, when resolved, returns an object containing the application instance and the loaded route/page components.

```js
// start the application
require('@dadi/web')({
  "engines":[
    require("@dadi/web-dustjs")
  ]
}).then(loaded => {
  console.log(loaded.App)
  console.log(loaded.Components)
})
```

This change replaces the exported modules in previous versions. To obtain a reference to these modules when the application has already started (for example when loading template helpers), require @dadi/web without passing an engine argument:

```js
require('@dadi/web')().then(loaded => {
  console.log(loaded.App)
  console.log(loaded.Components)
})
```

## Changed

#### Page caching

Page caching is now on by default if `caching` is specified in the configuration. Page specification files no longer require `cache: true` for caching to be enabled.

### Route processing

Version 4.0 performs route determination faster. In previous versions a request was tested against all loaded page components at the beginning of the request, and an array of matching routes was added to the middleware stack. In this version matching app-specific routes are loaded only if processing the middleware stack yields no matching handlers.

### Request logging

Requests for static files are now passed through the request logger, giving more detailed access logs for the full request cycle.

### Other

* Removed support for event-logging system "Sentry". This feature was untested and unused
* Added new middleware to serve content from the public folder, removing dependency on Express.js modules [serve-static](https://github.com/expressjs/serve-static) and [serve-favicon](https://github.com/expressjs/serve-favicon).
* Moved helper methods `sendBackJSON`, `sendBackHTML` into `view/send.js`
* Removed unused helper `sendBackJSONP`
* Removed outdated/unused `media` path.
* Refactor of cache flush under `api/flush`. Added corresponding error page when method is not `POST`.
* Added `npm run format` to run for [standard](https://www.npmjs.com/package/standard) & [prettier](https://www.npmjs.com/package/prettier)
* Hide the err.stack from default error pages when the `NODE_ENV` environment variable is `production` (`NODE_ENV=production`)
* An improved developer experience: changes to event files & template partials/includes reinitialises the application without requiring a restart.

### Resolved issues

* [#51](http://github.com/dadi/web/issues/51): cache flush command fails when no matching page is found
* [#59](http://github.com/dadi/web/issues/59): add CSRF token
* [#168](http://github.com/dadi/web/issues/168): process routes after middleware
* [#173](http://github.com/dadi/web/issues/173): listener should trigger a 302 redirect
* [#175](http://github.com/dadi/web/issues/175): remove 'server' response header
* [#193](http://github.com/dadi/web/issues/193): reload templates and event files when changed on disk (without restarting app)
* [#212](http://github.com/dadi/web/issues/212): fix default workspace config error

# [3.1.0] - 2017-08-30

## Added

* [#59](https://github.com/dadi/web/issues/59): add support for CSRF token security. Usage information [here](https://github.com/dadi/web/pull/205)

## Changed

* [#204](https://github.com/dadi/web/issues/204): remove Sentry support in favour of a future error handing implementation
* [#209](https://github.com/dadi/web/issues/209): wait for components and routes to be loaed before exporting

# [3.0.4] - 2017-07-14

## Changed

* ensure static datasources are passed request parameters for filtering data

# [3.0.2] - 2017-07-06

## Changed

* throw error at startup when the pages directory contains templates without an engine that can handle them
* fix an issue where information about the loaded engines on the app startup screen was sometimes incorrect

# [3.0.1] - 2017-07-05

## Changed

* add https://github.com/dadi/web-dustjs as dependency
* modify post install script to include the above plugin when creating the server.js file

# [3.0.0] - 2017-07-04

## Added

* [#103](https://github.com/dadi/web/issues/103): multiple template engine support

## Changed

* [#184](https://github.com/dadi/web/issues/184): unrestricted environment configurations allowed
* [#175](https://github.com/dadi/web/issues/175): response header "SERVER (DADI)" removed
* [#165](https://github.com/dadi/web/issues/165): only check matching routes after all middleware functions have completed
* [#98](https://github.com/dadi/web/issues/98): log more informative error when an event fails

# [2.1.0] - 2017-04-06

## Changed

* ensure request parameters passed to Markdown provider

# [2.0.0] - 2017-04-06

## Added

* [#120](https://github.com/dadi/web/issues/120): add post install scripts to copy configuration and workspace files
* [#135](https://github.com/dadi/web/issues/135): allow requestParams to replace placeholders in datasource endpoints by specifying an additional property: `"target": "endpoint"`
* [#137](https://github.com/dadi/web/issues/137): allow configuration of virtual hosts which can specify overriding `workspace` and `global` properties. configuration details at https://github.com/dadi/web/pull/138
* add new remote data provider, using the original as a dedicated DADI API data provider

## Changed

* [#128](https://github.com/dadi/web/issues/128): attach compression middleware prior to static middleware
* [#130](https://github.com/dadi/web/issues/130): leave url params unmodified when lowercasing urls
* [#139](https://github.com/dadi/web/issues/139) remove datasource path from attributes
* [#144](https://github.com/dadi/web/issues/144): check host header against specified hosts before serving static files
* don’t modify original schema endpoint ([4901ecc](https://github.com/dadi/web/commit/4901ecc))
* rename sample-workspace to workspace ([c307b8e](https://github.com/dadi/web/commit/c307b8e))

# [1.10.0] - 2017-02-25

## Added

* [#117](https://github.com/dadi/web/issues/117): allow an array of partial paths
* add metadata for pagination ([e34be99](https://github.com/dadi/web/commit/e34be99))
* add pagination to Markdown provider ([09618e7](https://github.com/dadi/web/commit/09618e7))
* add transportSecurity configuration option ([03fd4e8](https://github.com/dadi/web/commit/03fd4e8))
* API connection disabled by default ([1199527](https://github.com/dadi/web/commit/1199527))
* start in cluster mode by default ([5987dd2](https://github.com/dadi/web/commit/5987dd2))

## Changed

* [#123](https://github.com/dadi/web/issues/123): xxx
* [#110](https://github.com/dadi/web/issues/110): filter hidden files for xx
* use debug statements instead of log statements ([e425040](https://github.com/dadi/web/commit/e425040))
* implement transportSecurity properly ([f18764c](https://github.com/dadi/web/commit/f18764c))
* pass authstrategy to Bearer module ([3a6bacc](https://github.com/dadi/web/commit/3a6bacc))
* rebuild chained datasource endpoints after applying results from chainee

## [1.8.0] - 2017-01-23

## Added

* add example https config file ([d069b2b](https://github.com/dadi/web/commit/d069b2b))
* add http/http+https/https support ([05cee15](https://github.com/dadi/web/commit/05cee15))
* add markdown provider ([71070a0](https://github.com/dadi/web/commit/71070a0))
* add search/filter/sort/count/fields methods ([a8e88ce](https://github.com/dadi/web/commit/a8e88ce))

## Changed

* allow a 404 route to skip validation ([9ba36b6](https://github.com/dadi/web/commit/9ba36b6))
* extend ds cache options using main config options ([c0e9a12](https://github.com/dadi/web/commit/c0e9a12))
* make hard-coded protocol redirect dynamic ([52f7fe8](https://github.com/dadi/web/commit/52f7fe8))
* make tests run cross platform ([2f3f708](https://github.com/dadi/web/commit/2f3f708))
* redirect http to https with 301 instead of 302 ([ae6c13a](https://github.com/dadi/web/commit/ae6c13a))
* remove call to hasOwnProperty for node >= 6 ([cfa48ad](https://github.com/dadi/web/commit/cfa48ad))

## [1.7.3] - 2017-01-11

### Changed
* Now runs on latest Node versions 4.7.0, 5.12.0, 6.9.2
* Improved build and test for cross platform usage, now works under Windows 10

## [1.7.2] - 2016-12-02

### Changed

* Fix: configured 404 pages now render the associated template and don't simply return
the content of the page specification file (https://github.com/dadi/web/issues/101)

## [1.7.0] - 2016-11-14

### Added

#### Cache-Control headers for redirects

A `cache-control` header can be added to a 301/302 redirect by adding to the `headers` configuration block:

```
"headers": {
  "cacheControl": {
    "301": "no-cache"
  }
}
```

#### Preloaded Data

The Web configuration file now has provision for specifying datasources that should be loaded at startup. Add preload datasources by adding a block to the configuration file:

```js
data: {
  preload: [
    "categories"
  ]
}
```

Accessing preloaded data in Web events is as simple as passing the datasource key to the `Preload` module:

```js
var Preload = require('@dadi/web').Preload
var categories = Preload().get('categories')
```
The preloader stores the contents of the inner results property of the data that is returned, so there is no `metadata` section as you would normally find in data returned from DADI API.

> **Note:** There is no refresh of this preloaded data, yet. Refresh support will be added in a future release.

#### Route Validation/Constraints

DADI Web 1.7.0 introduces several new ways to ensure the correct route is loaded for a particular request, hopefully reducing the hacky workarounds we've implemented for some projects.

See the documentation at http://docs.dadi.tech/web/concepts/routing/#route-validation

> For assistance with routing changes, please add an issue to your project and assign it to `jimlambie`.

### Changed

#### Dust Helpers removed

Version 1.7.0 sees the completion of the extraction of the built-in Dust helpers. These are no longer available in the core Web product and must be loaded separately, see https://www.npmjs.com/package/@dadi/dustjs-helpers for usage information.


#### Page Route Specification

DADI Web 1.7.0 introduces a more explicit way of specifying multiple routes per page . The `route` property has been replaced with `routes` which should be an Array of route objects.

Each route object must contain, at the very least, a `path` property. At startup, Web adds the value of each `path` property to an internal collection of routes for matching incoming requests.

In this example, the same page (and therefore it's template) will be loaded for requests matching any of the formats specified by the `path` properties:

```js
"routes": [
  {
    "path": "/movies/:title"
  },
  {
    "path": "/movies/news/:title?/"
  },
  {
    "path": "/movies/news/:page?/"
  }
]
```

#### Integration of @dadi/cache

The DADI Cache module has replaced the caching code in Web 1.7.0. DADI Cache includes better failover support for when Redis connections fail. Datasources now require a caching configuration similar the main config. See the next section, **Migration to Version 1.7.0**.

#### Migrating to Version 1.7.0

To help you migrate your Web installation to v1.7.0, the router will inform you of any changes required to page specifications if the existing `route` property has not yet been modified.

Look out for console messages similar to the following:

```
The `route` property for pages has been extended to provide better routing functionality.
Please modify the route property for page 'movies_news'. The schema should change to the below:

{
  "page": {
    "name": "movies_news",
    "description": "movies news",
    "language": "en"
  },
  "settings": {
    "cache": true
  },
  "datasources": [],
  "events": [],
  "routes": [
    {
      "path": "/movies/news/:furl?/"
    }
  ]
}
```

#### Migration of datasource specifications

> Note that it isn't a requirement to specify caching for datasources, as they will use the main configuration settings if none are specified.

Prior to 1.7.0, caching configuration took the following format:

```
"caching": {
  "enabled": true,
  "ttl": 300,
  "directory": "./cache/web/",
  "extension": "json"
}
```

In 1.7.0 this has changed. If you want your datasources to be cached differently to pages, the caching configuration should now appear similar to the main configuration file:

```
"caching": {
  "ttl": 300,
  "directory": {
    "enabled": true,
    "path": "./cache/web/",
    "extension": "json"
  },
  "redis": {
    "enabled": false
  }
}
```

## [1.6.0] - 2016-06-08

This version update adds the ability to use a datasource as the main source of the htaccess style rewrites

Add the following block to configuration, specifying an existing datasource name:
```
rewrites: {
   datasource: "rewrites"
   path: ""
 }
```

## [1.5.0] - 2016-06-08

### Added

* Cluster support
This version adds support for running in cluster mode to take advantage of multiple core CPUs.

The default configuration _does not_ use cluster mode. To enable, add the following to configuration:

```js
"cluster": true
```

Web will report it is running in cluster mode at startup.

* fix #63: don't use main config options for ds extension

    if no cache config options are provided for a datasource the main
    config settings are used. for a datasource, we need to use .json
    by default, rather than the main config setting

* add 503 server too busy response

## [1.4.0] - 2016-05-05

### Added
* allow port configuration to be set from environment variable PORT
* add support for HTTPS
* add page template metadata to returned JSON:
  ```
  "page": {
    "name": "movies_news",
    "description": "movies news",
    "language": "en"
  }
  ```
* add config option to force a domain redirect

    this allows a setting in config as below which will force redirecting
    to the specified domain, e.g. useful to redirect a root domain to www.

    ```
    "rewrites": {
      "forceDomain": "www.example.com"
    }
    ```

  * allow Redis use for session store configuration
  * add token wallet path to `paths` configuration blocks
  * integration of @dadi/passport for token generation/validation
  * add protocol option to `api` and `auth` configuration blocks

### Changed

* fix: bug where an ID parameter from the request URL was added to all subsequent datasource filters
* fix: bug where caching was performed routing, therefore sometimes ignoring routes
* fix: allow datasource configuration to override protocol:
  * Previous versions assumed if the API settings used HTTPS then the datasource calls should too. Fix to allow
   a datasource to specify it's protocol and have that override the API setting.
* fix #48: test current URL against returned redirect results:
  * when using a datasource for redirects, ensure that any results
  returned are matched against the URL before redirecting the request
* fix: allow any format for config setting sessions.cookie.maxAge

    the default for express-session is to use `cookie.maxAge = null`
    which means no "expires" parameter is set so the cookie becomes
    a browser-session cookie.

    When the user closes the browser the cookie (and session) will be removed.

## [1.3.0] - 2016-03-22

### Added

#### Status endpoint

Adds an endpoint at `/api/status` which returns server/application data in JSON format.

The request must be a POST and the body must have a `clientId` and `secret` that match those stored in the application's config file.

```
POST /api/status HTTP/1.1
Host: www.example.com
Content-Type: application/json

{"clientId": "testClient","secret": "superSecret"}
```

#### requestParams type definition

Now allows the ability to specify a type definition of 'Number' on requestParams in a datasource
schema to override default of String. Thanks @mingard!

```
"requestParams": [
  { "param": "author", "field": "authorId", "type": "Number" }
]
```

### Changed

#### Partials in subdirectories

Storing partials in subdirectories of the main partials folder previously caused the application crash. Now it doesn't. Thanks @eduardoboucas!

## [1.2.0] - 2016-03-18

### Added
* Add: additional routing/rewriting config properties
* Add #37: Global events loader

### Changed
* Fix #38: replace datasource loader in router
* Fix #36: load events in the order they were specified
* Fix #32: load template from filesystem if Dust cache is_disabled
* Fix #31: define the zlib variable
* Fix #29: refresh endpoint filter on subsequent page loads

## [1.1.0] - 2016-03-11

### Added
#### Cache Invalidation
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

#### Datasource filter events

A datasource can now specify a `filterEvent` property. Before the datasource attempts to load data
it will load and run an event file matching the `filterEvent` property. Filter events are identical to normal
event files, but they should return a filter object that the datasource will use when querying the API for data.

**Example filter event: /app/events/datasourceFilterTest.js**
```js
// the `data` parameter contains the data already loaded by
// the page's datasources
var Event = function (req, res, data, callback) {
  var filter = { "x": "1" }
  callback(null, filter)
}

module.exports = function (req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event;
```


### Changed
#### Datasource Sort property

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

## [0.5.0] - 2016-01-08

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


## [0.1.7] - 2015-12-06

### Added
* Add config option for socket timeout, defaults to 30 seconds
* Keepalive header added to API data & auth requests


## [0.1.7] - 2015-11-26

* Server:
  - Error if the configured API can't be reached
  - Simplify middleware loading
* Logging:
  - Simplify error logging
  - Provide configuration for logging to a Sentry server
  - Remove Slack logging option, as this can be done from Sentry
* Config:
  - Provide configuration for logging to a Sentry server

## [0.1.6] - 2015-11-12

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
