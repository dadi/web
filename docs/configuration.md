### Configuration

#### Example Configuration File

```js
{
    "logging": {
        "enabled": true,
        "level": "DEBUG",
        "path": "./log",
        "filename": "rosecomb",
        "dateFormat": "",
        "extension": "log",
        "messageFormat": "<%= label %> - <%= date %> - <%= message %>"
    },
    "caching": {
        "enabled": true,
        "ttl": 300,
        "directory": "./cache/rosecomb/",
        "extension": "html"
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
    }
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
enabled           | Sets caching enabled or disabled   | enabled              | enabled
ttl           |    |               |  300      
directory           | The directory to use for storing cache files, relative to the root of the application   |               | "./cache/rosecomb"
extension           | The file extension to use for cache files   |    "html"           |  "html"

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