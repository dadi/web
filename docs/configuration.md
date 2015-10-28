### Configuration

#### Example Configuration File

```js
{
    "logging": {
        "enabled": true,
        "path": "./log",
        "filename": "rosecomb",
        "extension": "log"
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
            "host": "",
            "port": 6379
        }
    },
    "server": {
        "host": "127.0.0.1",
        "port": 3020
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
    "global" : {
        "baseUrl": "http://www.example.com"
    },
    "dust": {
        "cache": true,
        "debug": false,
        "debugLevel": "INFO",
        "whitespace": false
    },
    "debug": true,
    "allowJsonView": true
}
```

#### Property Description

###### Section: `logging`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
enabled           |    |            true   | true       
level           |    |           "DEBUG"    | "DEBUG", "STAGE", "PROD"
path           |    |               | "./log"
filename           | |               | "rosecomb"      
extension           |  |     | "log"
dateFormat           |    |               | "YYYY-MM-DD"
messageFormat           |   |               | "<%= label %> - <%= date %> - <%= message %>"

###### Section: `caching`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
ttl           |    |               |  300      
directory           | Configuration block for caching using a local filesystem directory   |               |
directory.enabled           | Sets directory caching enabled or disabled. Either directory or redis caching must be enabled for caching to work.   | true              | true
directory.path           | The directory to use for storing cache files, relative to the root of the application   |    "./cache/rosecomb"           |  "./cache/rosecomb"
directory.extension           | The file extension to use for cache files   |    "html"           |  "html"
redis           | Configuration block for caching using a Redis caching service   |               |
redis.enabled           | Sets directory caching enabled or disabled. Either directory or redis caching must be enabled for caching to work.   | false              | true
redis.host           | The host for the Redis caching service   |    ""           |  "project.stimkl.oh.0001.euw1.cache.amazonaws.com"
redis.port           | The port for the Redis caching service   |    6379           |  6379

###### Section: `auth`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
tokenUrl           |    |               |     "/token"   
clientId           |    |               |        "test123"
secret           |    |               |         "superSecret"

###### Section: `server`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
host           |    |               | api.example.com       
port           |    |               | 3000

###### Section: `api`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
host           |    |               | api.example.com       
port           |    |               | 3000

###### Section: `dust`

 Property       | Description         | Default value  |  Example
:---------------|:--------------------|:---------------|:--------------
cache           |    									|       true     | true       
debug           |    									|       true     | true       
debugLevel      |                     |       "DEBUG"  | "DEBUG"
whitespace      |                     |       true     | false

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
