var convict = require('convict');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "DADI Web (Repo Default)"
    }
  },
	server: {
    host: {
      doc: "The IP address the web application will run on",
      format: '*',
      default: '0.0.0.0'
    },
    port: {
      doc: "The port the web application will bind to",
      format: 'port',
      default: 8080
    },
    name: {
      doc: "The server name.",
      format: String,
      default: "DADI (Web)"
    },
    socketTimeoutSec: {
      doc: "The number of seconds to wait before closing an idle socket",
      format: Number,
      default: 120
    }
  },
	api: {
    host: {
      doc: "The IP address the DADI API application runs on",
      format: '*',
      default: '0.0.0.0'
    },
    port: {
      doc: "The port for the DADI API application",
      format: 'port',
      default: 8080
    },
    enabled: {
      doc: "Determines whether this web instance requires access to the API",
      format: Boolean,
      default: true
    }
  },
  auth: {
  	tokenUrl: {
      doc: "",
      format: String,
      default: "/token"
    },
    clientId: {
      doc: "",
      format: String,
      default: "testClient"
    },
    secret: {
      doc: "",
      format: String,
      default: "superSecret"
    }
  },
  aws: {
    accessKeyId: {
      doc: "",
      format: String,
      default: ""
    },
    secretAccessKey: {
      doc: "",
      format: String,
      default: ""
    },
    region: {
      doc: "",
      format: String,
      default: ""
    }
  },
  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 300
    },
    directory: {
      enabled: {
        doc: "If enabled, cache files will be saved to the filesystem",
        format: Boolean,
        default: true
      },
      path: {
        doc: "The relative path to the cache directory",
        format: String,
        default: "./cache/web"
      },
      extension: {
        doc: "The extension to use for cache files",
        format: String,
        default: "html"
      }
    },
    redis: {
      enabled: {
        doc: "If enabled, cache files will be saved to the specified Redis server",
        format: Boolean,
        default: false
      },
      host: {
        doc: "The Redis server host",
        format: String,
        default: "tresting.qvhlji.ng.0001.euw1.cache.amazonaws.com"
      },
      port: {
        doc: "The port for the Redis server",
        format: 'port',
        default: 6379
      },
      password: {
        doc: "",
        format: String,
        default: ""
      }
    }
  },
  dust: {
  	cache: {
      doc: "Determines if Dust caching is enabled",
      format: Boolean,
      default: true
    },
    debug: {
      doc: "",
      format: Boolean,
      default: true
    },
    debugLevel: {
      doc: "",
      format: String,
      default: "DEBUG"
    },
    whitespace: {
      doc: "",
      format: Boolean,
      default: false
    }
  },
  headers: {
    useGzipCompression: {
      doc: "If true, uses gzip compression and adds a 'Content-Encoding:gzip' header to the response.",
      format: Boolean,
      default: false
    },
    cacheControl: {
      doc: "A set of custom cache control headers for different content types. For example 'cacheControl': { 'text/css': 'public, max-age=1000' }",
      format: Object,
      default: {
        "text/css": "public, max-age=86400",
        "text/javascript": "public, max-age=86400",
        "application/javascript": "public, max-age=86400"
      }
    }
  },
  logging: {
  	enabled: {
      doc: "If true, logging is enabled using the following settings.",
      format: Boolean,
      default: true
    },
    path: {
      doc: "The absolute or relative path to the directory for log files.",
      format: String,
      default: "./log"
    },
    filename: {
      doc: "The name to use for the log file, without extension.",
      format: String,
      default: "web"
    },
    extension: {
      doc: "The extension to use for the log file.",
      format: String,
      default: "log"
    },
    accessLog: {
      enabled: {
        doc: "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `web.access.log`.",
        format: Boolean,
        default: true
      },
      fileRotationPeriod: {
        doc: "The period at which to rotate the access log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms' (milliseconds), 'h' (hours), 'd' (days), 'w' (weeks), 'm' (months), 'y' (years). The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y').",
        format: String,
        default: "1d"  // daily rotation
      },
      fileRetentionCount: {
        doc: "The number of rotated log files to keep.",
        format: Number,
        default: 7    // keep 7 back copies
      },
      kinesisStream: {
        doc: "An AWS Kinesis stream to write to log records to.",
        format: String,
        default: ""
      }
    },
    sentry: {
      enabled: {
        doc: "If true, error logging to a Sentry server is enabled.",
        format: Boolean,
        default: false
      },
      dsn: {
        doc: "The 'DSN' to use for Sentry logging. It should be similar to 'https://693ef18da3184cffa82144fde2979cbc:a0651b0286784761a62ef8e8fc128722@app.getsentry.com/59524'.",
        format: String,
        default: ""
      }
    }
  },
  paths: {
    doc: "",
    format: Object,
    default: {
      datasourcePath: __dirname + '/app/datasources',
      eventPath: __dirname + '/app/events',
      filtersPath: __dirname + '/app/utils/filters',
      helpersPath: __dirname + '/app/utils/helpers',
      mediaPath: __dirname + '/app/media',
      middlewarePath: __dirname + '/app/middleware',
      pagePath: __dirname + '/app/pages',
      partialPath: __dirname + '/app/partials',
      publicPath: __dirname + '/app/public',
      routesPath: __dirname + '/app/routes',
      workspacePath: __dirname + '/workspace'
    }
  },
  sessions: {
    enabled: {
      doc: "",
      format: Boolean,
      default: false
    },
    name: {
      doc: "The session cookie name. The default value is 'dadiweb.sid'",
      format: String,
      default: "dadiweb.sid"
    },
    secret: {
      doc: "This is the secret used to sign the session ID cookie. This can be either a string for a single secret, or an array of multiple secrets. If an array of secrets is provided, only the first element will be used to sign the session ID cookie, while all the elements will be considered when verifying the signature in requests.",
      format: String,
      default: "dadiwebsecretsquirrel"
    },
    resave: {
      doc: "Forces the session to be saved back to the session store, even if the session was never modified during the request.",
      format: Boolean,
      default: false
    },
    saveUninitialized: {
      doc: "Forces a session that is 'uninitialized' to be saved to the store. A session is uninitialized when it is new but not modified.",
      format: Boolean,
      default: false
    },
    store: {
      doc: "The session store instance, defaults to a new MemoryStore instance.",
      format: String,
      default: ""
    },
    cookie: {
      maxAge: {
        doc: "Set the cookie’s expiration as an interval of seconds in the future, relative to the time the browser received the cookie. Null means no 'expires' parameter is set so the cookie becomes a browser-session cookie. When the user closes the browser the cookie (and session) will be removed.",
        format: Number,
        default: 60000
      },
      secure: {
        doc: "",
        format: Boolean,
        default: false
      }
    }
  },
  rewrites: {
    datasource: {
      doc: "",
      format: String,
      default: ""
    },
    path: {
      doc: "",
      format: String,
      default: ""
    },
    forceTrailingSlash: {
      doc: "",
      format: Boolean,
      default: false
    }
  },
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test", "qa"],
    default: "development",
    env: "NODE_ENV",
    arg: "node_env"
  },
  virtualDirectories: {
    doc: "Allows specifying folders relative to the root of the application where additional static content may reside. An array entry should like look { path: 'data/legacy_features', index: 'default.html', forceTrailingSlash: false } ",
    format: Array,
    default: []
  },
  debug: {
    doc: "If true, debug mode is enabled and a panel containing the JSON loaded for each page is displayed alongside the normal content.",
    format: Boolean,
    default: false
  },
  allowJsonView: {
    doc: "If true, allows appending ?json=true to the querystring to view the raw JSON output for each page.",
    format: Boolean,
    default: false
  }
});

// Load environment dependent configuration
var env = conf.get('env');
conf.loadFile('./config/config.' + env + '.json');

// Perform validation
conf.validate({strict: false});

module.exports = conf;
