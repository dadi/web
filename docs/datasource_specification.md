### Datasource Specification

#### Example datasource Specification

```
{
    "datasource": {
        "key": "car-makes",
        "name": "Makes datasource",
        "source": {
            "type": "remote",
            "protocol": "http",
            "host": "127.0.0.1",
            "port": "3000",
            "endpoint": "1.0/car-data/makes"
        },
        "caching": {
            "enabled": true,
            "ttl": 300,
            "directory": "./cache/rosecomb/",
            "extension": "json"
        },
        "auth": {
            "type": "bearer",
            "host": "127.0.0.1",
            "port": "3000",
            "tokenUrl": "/token",
            "credentials": {
                "clientId": "test123",
                "secret": "superSecret"
            }
        },
        "paginate": true,
        "count": 5,
        "sort": [
            { "field": "name", "order": "desc" }
        ],
        "search": {},
        "filter": {},
        "fields": ["name", "capId"],
        "requestParams": [{
            "param": "make",
            "field": "name"
        }]
    }
}

```

#### Property Description

###### Section: `datasource`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
key           | Name of datasource this is used in the page descriptor to attach a datasource   |               | books       
name           | This is the name of the datasource, it will be displayed on the front-end of the gui   |               | Books       
paginate           |    | true              | true
count           | Number of items to return from the endpoint per page. If set to '0' then all results will be returned    | 20              | 5       
sort           | An array of fields to order the result set by |     | [ { "field": "title", "order": "asc" } ]
search           |    |               |
filter           | A JSON object containing a MongoDB query  |               | { "SaleDate" : { "$ne" : null} }
fields           | Limit fields to return   |               | ["title", "author"]
requestParams           | An array of parameters the datasource can accept from the querystring   |               | [ { "param": "author", "field": "author_id" } ]

###### Section: `datasource.source`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
type           | Determines whether the data is from a remote endpoint or local, static data   | "remote"              | "remote", "static"       
protocol           | The protocol portion of an endpoint URI   | "http"              | "http", "https"
host           | The host portion of an endpoint URL   |               | "api.example.com"
port           | The port portion of an endpoint URL (optional)   |               | "3001"
endpoint           | The path to the endpoint which contains the data for this datasource   |               | "/1.0/news/articles"       

###### Section: `datasource.caching`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
enabled           | Sets caching enabled or disabled   | enabled              | enabled
ttl           |    |               |        
directory           | The directory to use for storing cache files, relative to the root of the application   |               | "./cache"
extension           | The file extension to use for cache files   |               |  "json"

###### Section: `datasource.auth`

 Property       | Description                 | Default value  |  Example
:---------------|:----------------------------|:---------------|:--------------
type           |    |               | bearer
host           |    |               | api.example.com       
port           |    |               | 3000
tokenUrl           |    |               |     "/token"   
credentials           |    |               |        { "clientId": "test123", "secret": "superSecret" }

#### requestParams

An array of parameters that this datasource can accept from the querystring. Used in conjunction with the custom routing option in the page specification.

```js
"requestParams": [
    { "param": "make", "field": "name" }
]
```

The `param` value should match the parameter specified in the page route, and the `field` value should match the MongoDB field to be queried.

###### For example, given a MongoDB collection `makes` with the fields `_id`, `name`:

With the route `/cars/:make/:model` and the above requestParams, Rosecomb will extract the `:make` parameter from the URL and use it to query the MongoDB collection using the field `name`.

With a request to `http://www.example.com/cars/ford/focus`, Rosecomb will extract the named `:make` parameter from the URL, which in this case is `Ford`. A filter query is constructed for Serama using this parameter but translating it using the `field` value.

The Serama query becomes `{ "name" : "Ford" }`.


See [Page Specification](page_specification.md) for custom routing information.

#### Chaining datasources

It is often a requirement to query a datasource using data from another datasource. Rosecomb supports this through the use of chained datasources.

Add the `chained` property to the datasource that relies on data loaded by another datasource.

_Simple field replacement_

```js
"chained": {
  "datasource": "car-makes",
  "outputParam": {
    "param": "results.0.capId",
    "field": "makeId"
  }
}
```

_Filter replacement_

```js
"filter": ["{capRangeByUrlModel}",{"$group":{"_id":{"fuelType":"$fuelType"}}}],
"chained": {
  "datasource": "capRangeByUrlModel",
  "outputParam": {
    "param": "results.0.capRanId",
    "type": "Number",
    "query": {"$match":{"capRanId": "{param}"}}
  }
}
```

* `datasource` Should match the `key` property of the primary datasource.
* `outputParam` The `param` value specifies where to locate the output value in the results returned by the primary datasource. The `field` value should match the MongoDB field to be queried. The `type` value indicates how the `param` value should be treated (currently only "Number" is supported). The `query` property allows more advanced filtering, see below for more detail.  

###### For example

On a page that displays a car make and all it's associated models, we have two datasources querying two collections, __makes__ and __models__.

** Collections **

* __makes__ has the fields `_id` and `name`
* __models__ has the fields `_id`, `makeId` and `name`

** Datasources **

* The primary datasource, `makes` (some properties removed for brevity)

```
{
    "datasource": {
         "key": "makes",
         "source": {
             "endpoint": "1.0/car-data/makes"
         },
         filter: { "name": "Ford" }
     }
}
```

The result of this datasource will be:

```
{
    "results": [
        {
            "_id": "5596048644713e80a10e0290",
            "name": "Ford"
        }
    ]
}
```

To query the models collection based on the above data being returned, add a `chained` property to the models datasource specifying `makes` as the primary datasource:

```
{
    "datasource": {
         "key": "models",
         "source": {
             "endpoint": "1.0/car-data/models"
         },
         "chained": {
            "datasource": "makes",
            "outputParam": {
                "param": "results.0._id",
                "field": "makeId"
            }
        }
     }
}
```
In this scenario the **models** collection will be queried using the value of `_id` from the first document of the `results` array returned by the **makes** datasource.

If your query parameter must be passed to the endpoint as an integer, add a `type` property to the `outputParam` specifying `"Number"`.
```
{
    "datasource": {
         "key": "models",
         "source": {
             "endpoint": "1.0/car-data/models"
         },
         "chained": {
            "datasource": "makes",
            "outputParam": {
                "param": "results.0._id",
                "type": "Number",
                "field": "makeId"
            }
        }
     }
}
```

###### Filter replacement

```js
"filter": ["{capRangeByUrlModel}",{"$group":{"_id":{"fuelType":"$fuelType"}}}],
"chained": {
  "datasource": "capRangeByUrlModel",
  "outputParam": {
    "param": "results.0.capRanId",
    "type": "Number",
    "query": {"$match":{"capRanId": "{param}"}}
  }
}
```
