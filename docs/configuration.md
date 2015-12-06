### Configuration

#### Example Configuration File

```js
{
    "app": {
        "name": "Project Name Here"
    },
    "server": {
        "host": "127.0.0.1",
        "port": 3020,
        "socketTimeoutSec": 30
    },
    "api": {
        "host": "127.0.0.1",
        "port": 3000
    },
    "auth": {
        "tokenUrl":"/token",
        "clientId":"rosecombClient",
        "secret":"superSecret"
    },
    "aws": {
      "accessKeyId": "<your key here>",
      "secretAccessKey": "<your secret here>",
      "region": "eu-west-1"
    },
    "caching": {
        "ttl": 300,
        "directory": {
            "enabled": true,
            "path": "./cache/rosecomb/",
            "extension": "html"
        },
        "redis": {
            "enabled": false,
            "host": "project.stimkl.oh.0001.euw1.cache.amazonaws.com",
            "port": 6379
        }
    },
    "dust": {
        "cache": true,
        "debug": false,
        "debugLevel": "INFO",
        "whitespace": false
    },
    "headers": {
        "useGzipCompression": true,
        "cacheControl": {
          "text/css": "public, max-age=86400"
        }
    },
    "logging": {
        "enabled": true,
        "path": "./log",
        "filename": "rosecomb",
        "extension": "log",
        "accessLog": {
            "enabled": true,
            "fileRotationPeriod": "1d",
            "fileRetentionCount": 14,
            "kinesisStream": "rosecomb_test"
        }
    },
    "rewrites": {
        "datasource": "rewrites",
        "path": "workspace/routes/rewrites.txt",
        "forceTrailingSlash": true
    },
    "global" : {
        "baseUrl": "http://www.example.com"
    },
    "debug": true,
    "allowJsonView": true
}
```

#### Property Description

Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
debug           | If true, enables a debug panel on every page containing the loaded data and execution stats   |     false          | true
allowJsonView           |  If true, allows ?json=true in the querystring to return a view of the raw data loaded for the page  |   false            | true

###### Section: `server`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
host           |    |               | api.example.com       
port           |    |               | 3000
socketTimeoutSec           | The number of seconds to wait before closing an idle socket   |        30       | 10

###### Section: `api`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
host           |    |               | api.example.com       
port           |    |               | 3000

###### Section: `auth`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
tokenUrl           |    |               |     "/token"   
clientId           |    |               |        "test123"
secret           |    |               |         "superSecret"

###### Section: `caching`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
ttl           |    |               |  300      
directory           | Configuration block for caching using a local filesystem directory   |               |
directory.enabled           | If true, cache files will be stored on disk using the settings below. Either directory or redis caching must be enabled for caching to work.   | true              | true
directory.path           | The directory to use for storing cache files, relative to the root of the application   |    "./cache/rosecomb"           |  "./cache/rosecomb"
directory.extension           | The file extension to use for cache files   |    "html"           |  "html"
redis           | Configuration block for caching using a Redis caching service   |               |
redis.enabled           | If true, cache files will be stored in the Redis cache store using the settings below. Either directory or redis caching must be enabled for caching to work.   | false              | true
redis.host           | The host for the Redis caching service   |    ""           |  See example config above.
redis.port           | The port for the Redis caching service   |    6379           |  6379


###### Section: `dust`

 Property       | Description         | Default value  |  Example
:---------------|:--------------------|:---------------|:--------------
cache           |    									|       true     | true       
debug           |    									|       true     | true       
debugLevel      |                     |       "DEBUG"  | "DEBUG"
whitespace      |                     |       true     | false

###### Section: `headers`

 Property       | Description         | Default value  |  Example
:---------------|:--------------------|:---------------|:--------------
useGzipCompressiom           |    									|       true     | true       
cacheControl           |    									|       true     | true       

###### Section: `logging`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
enabled           | If true, logging is enabled using the following settings.   |            true   | true       
path           | The absolute or relative path to the directory for log files.   |       "./log"        | "/data/app/log"
filename           | The filename to use for the log files. The name you choose will be given a suffix indicating the current application environment. |    "rosecomb"           | "your_application_name"      
extension           | The extension to use for the log files.  |  "log"   | "txt"

###### Section: `logging.accessLog`

Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
enabled           | If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `rosecomb.access.log`.   |            true   | true       
fileRotationPeriod           | The period at which to rotate the access log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms', 'h', 'd', 'w', 'm', 'y'. The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y').   |       "1d"        | "daily"
fileRetentionCount           | The number of rotated log files to keep. |    7           | 14
kinesisStream           | An AWS Kinesis stream to write to log records to. |  ""   | "rosecomb_aws_kinesis"

###### Section: `logging.aws`

Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
accessKeyId           |    |    ""   | ""
secretAccessKey           |    |       ""        | ""
region           |  |    ""           | ""

###### Section: `rewrites`

Property           | Description                 | Default value  |  Example
:------------------|:----------------------------|:---------------|:--------------
datasource         |            |  ""   |  "rewrites"
path               |            | ""    | "workspace/routes/rewrites.txt"
forceTrailingSlash |            | false | true

###### Section: `global`

The `global` section can be used for any application parameters that should be available for use in page templates, such as asset locations, 3rd party account identifiers, etc

```js
"global" : {
  "baseUrl": "http://www.example.com"
}
```

In the above example `baseUrl` would be availabe to a page template and could be used in the following way:

```html
<html>
<body>
  <h1>Welcome to Rosecomb</h1>
  <img src="{baseUrl}/images/welcome.png"/>
</body>
</html>
```
