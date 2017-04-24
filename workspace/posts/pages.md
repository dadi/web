---
date: 2016-04-17
title: How to create a new page
author: The DADI Team
---

Add files `your-page-name.json` and `your-page-name.dust` to the `workspace/pages` folder:

```json
{
  "page": {
    "name": "your_page_name",
    "description": "A description so you know what it does",
  },
  "routes": [
    {
      "path": "/your-page-name"
    }
  ]
}
```

In the dust file you can put any HTML or make use of the syntax provided by [Dust.js](http://www.dustjs.com/).

```
{>"partials/header" /}

Hello world!

{>"partials/footer" /}
```