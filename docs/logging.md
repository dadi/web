### Logging

[Bunyan](https://github.com/trentm/node-bunyan)

CLI
npm install -g bunyan

Bunyan log output is a stream of JSON objects. A CLI tool is provided for pretty-printing bunyan logs and for filtering.

```
$ tail log/web.development.log
```
```
{"name":"web","hostname":"hudson","pid":67025,"module":"router","level":30,"msg":"5 rewrites/redirects loaded.","time":"2015-10-27T09:14:01.856Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"auth","level":30,"msg":"Generating new access token for \"/bmw?cache=false&json=true\"","time":"2015-10-27T09:14:03.380Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"auth","level":30,"msg":"Token received.","time":"2015-10-27T09:14:04.510Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"datasource","level":30,"msg":"Datasource logging started (rewrites).","time":"2015-10-27T09:14:04.510Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"auth/bearer","level":30,"msg":"Generating new access token for datasource rewrites","time":"2015-10-27T09:14:04.517Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"helper","level":30,"msg":"https://127.0.0.1:3000/1.0/app/rewrites?count=3&page=1&filter={\"rule\":\"/bmw?cache=false&json=true\"}&fields={}&sort={}","time":"2015-10-27T09:14:04.623Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"auth/bearer","level":30,"msg":"Generating new access token for datasource car-makes","time":"2015-10-27T09:14:04.628Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"helper","level":30,"msg":"http://127.0.0.1:3000/1.0/cap/makes?count=20&page=1&filter={\"name\":\"bmw\"}&fields={\"name\":1,\"_id\":0}&sort={\"name\":1}","time":"2015-10-27T09:14:04.637Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"level":30,"module":"router","msg":"GET /bmw 200 1265ms","time":"2015-10-27T09:14:04.643Z","v":0}
{"name":"web","hostname":"hudson","pid":67025,"module":"server","level":30,"msg":"Server stopped, process exiting.","time":"2015-10-27T09:16:46.331Z","v":0}
```

### Pass the log to the CLI tool

```
$ tail log/web.development.log | bunyan
```
```
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on hudson: 5 rewrites/redirects loaded. (module=router)
[2015-10-27T09:14:03.380Z]  INFO: web/67025 on hudson: Generating new access token for "/bmw" (module=auth)
[2015-10-27T09:14:04.510Z]  INFO: web/67025 on hudson: Token received. (module=auth)
[2015-10-27T09:14:04.510Z]  INFO: web/67025 on hudson: Datasource logging started (rewrites). (module=datasource)
[2015-10-27T09:14:04.517Z]  INFO: web/67025 on hudson: Generating new access token for datasource rewrites (module=auth/bearer)
[2015-10-27T09:14:04.623Z]  INFO: web/67025 on hudson: https://127.0.0.1:3000/1.0/app/rewrites?count=3&page=1&filter={"rule":"/bmw"}&fields={}&sort={} (module=helper)
[2015-10-27T09:14:04.628Z]  INFO: web/67025 on hudson: Generating new access token for datasource car-makes (module=auth/bearer)
[2015-10-27T09:14:04.637Z]  INFO: web/67025 on hudson: http://127.0.0.1:3000/1.0/cap/makes?count=20&page=1&filter={"name":"bmw"}&fields={"name":1,"_id":0}&sort={"name":1} (module=helper)
[2015-10-27T09:14:04.643Z]  INFO: web/67025 on hudson: GET /bmw 200 1265ms (module=router)
[2015-10-27T09:16:46.331Z]  INFO: web/67025 on hudson: Server stopped, process exiting. (module=server)
```

### Filtering by condition

#### Filter by web module

```
$ tail -n30 log/web.development.log | bunyan -c 'this.module=="router"'
```
```
[2015-10-27T09:14:01.413Z]  INFO: web/67025 on hudson: Added route constraint function 'nextIfPaginationRequest' for '/movies/reviews/' (module=router)
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on hudson: Rewrite module unloaded. (module=router)
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on hudson: Rewrite module loaded. (module=router)
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on hudson: 5 rewrites/redirects loaded. (module=router)
[2015-10-27T09:14:04.643Z]  INFO: web/67025 on hudson: GET /bmw 200 1265ms (module=router)
```

#### Filter by any other valid Javascript condition

```
$ tail log/web.development.log | bunyan -c 'this.msg.indexOf("GET") > -1' -o short
```
```
09:11:57.618Z  INFO web: GET /bmw 200 1460ms (module=router)
09:13:18.325Z  INFO web: GET /bmw 200 2ms (module=router)
```

### Filtering by log level

```
$ tail log/web.test.log | bunyan -l warn
```
```
[2015-10-25T13:54:25.429Z]  WARN: web/58045 on hudson.local: log.stage() is deprecated and will be removed in a future release. Use log.debug(), log.info(), log.warn(), log.error(), log.trace() instead.
```

### Pretty printing of objects

```
[2015-10-22T03:12:28.328Z] ERROR: web/39177 on hudson: Error loading datasource schema "/web/workspace/datasources/car.json". Is it valid JSON?
    err: {
      "errno": -2,
      "code": "ENOENT",
      "path": "/web/workspace/datasources/car.json",
      "syscall": "open"
    }
```
