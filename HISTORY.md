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
