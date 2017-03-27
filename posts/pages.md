---
date: 2016-04-17
title: How to create a new page
handle: pages
author: The DADI Team
---

Add a your-page-name.json and your-page-name.dust to the `workspace/pages` folder:

```JSON
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

In your dust file you can put any HTML or [Dust.js](http://www.dustjs.com/)

```dustjs
{>"partials/header" /}

Hello world!

{>"partials/footer" /}
```