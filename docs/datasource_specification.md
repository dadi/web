### Datasource Specification


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

####workspace/data-sources/articles.json

datasource.key: Name of data-source this is used in the page descriptor to attach a data source
datasource.name: This is the name of the data source, it will be displayed on the front-end of the gui
datasource.source.endpoint: Link to endpoint on Serama
cache: false, // Sets caching enabled or disabled on Serama
paginate: true, // Turns pagination on and off on Serama
filters: // List of filters - See Serama brief for more info
        { "category": ["blog"] }
count: 5, // Number of items Serama has to return
sort: // Order of the result set
        "field": "_id",
        "order": "desc"
fields: ["title", "author"] // Limit fields to return


See [Page Specification](page_specification.md) for custom routing information.


```js
{
    "datasource": {
        "key": "car-makes",
        "name": "Makes datasource",
        "source": {
            "type": "remote",
            "protocol": "http",
            "host": "localhost",
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
            "host": "localhost",
            "port": "3000",
            "tokenUrl": "/token",
            "credentials": {
                "clientId": "test123",
                "secret": "superSecret"
            }
        },
        "paginate": true,
        "count": 5,
        "sort": {
            "field": "name",
            "order": "desc"
        },
        "search": {},
        "fields": ["name", "capId"],
        "requestParams": [{
            "param": "make",
            "field": "name"
        }]
    }
}

```