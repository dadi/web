const convict = require('convict')
const fs = require('fs')
const path = require('path')

// Set folder location differently if an npm install
const installRoot = ~process.cwd().indexOf('node_modules')
  ? __dirname
  : process.cwd()

// Define a schema
const conf = convict({
  app: {
    name: {
      doc: 'The applicaton name',
      format: String,
      default: 'DADI Web (Repo Default)'
    }
  },
  server: {
    host: {
      doc: 'The IP address the web application will run on',
      format: '*',
      default: '0.0.0.0'
    },
    port: {
      doc: 'The port the web application will bind to',
      format: 'port',
      default: 8080,
      env: 'PORT'
    },
    redirectPort: {
      doc: 'Port to redirect http connections to https from',
      format: 'port',
      default: 0,
      env: 'REDIRECT_PORT'
    },
    name: {
      doc: 'The server name.',
      format: String,
      default: 'DADI (Web)'
    },
    socketTimeoutSec: {
      doc: 'The number of seconds to wait before closing an idle socket',
      format: Number,
      default: 120
    },
    protocol: {
      doc: 'The protocol the web application will use',
      format: String,
      default: 'http',
      env: 'PROTOCOL'
    },
    sslPassphrase: {
      doc: 'The passphrase of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PASSPHRASE'
    },
    sslPrivateKeyPath: {
      doc: 'The filename of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PATH'
    },
    sslCertificatePath: {
      doc: 'The filename of the SSL certificate',
      format: String,
      default: '',
      env: 'SSL_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePath: {
      doc: 'The filename of an SSL intermediate certificate, if any',
      format: String,
      default: '',
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePaths: {
      doc:
        'The filenames of SSL intermediate certificates, overrides sslIntermediateCertificate (singular)',
      format: Array,
      default: [],
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATHS'
    }
  },
  auth: {
    tokenUrl: {
      doc: '',
      format: String,
      default: '/token'
    },
    protocol: {
      doc: '',
      format: String,
      default: 'http'
    },
    clientId: {
      doc: '',
      format: String,
      default: 'testClient',
      env: 'AUTH_TOKEN_ID'
    },
    secret: {
      doc: '',
      format: String,
      default: 'superSecret',
      env: 'AUTH_TOKEN_SECRET'
    }
  },
  api: {
    doc: 'Any apis and their auth for use in datasources.',
    format: Object,
    default: {}
  },
  aws: {
    accessKeyId: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_ACCESS_KEY'
    },
    secretAccessKey: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_SECRET_KEY'
    },
    region: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_REGION'
    }
  },
  caching: {
    ttl: {
      doc: 'The time, in seconds, after which cached data is considered stale',
      format: Number,
      default: 300
    },
    directory: {
      enabled: {
        doc: 'If enabled, cache files will be saved to the filesystem',
        format: Boolean,
        default: true
      },
      path: {
        doc: 'The relative path to the cache directory',
        format: String,
        default: './cache/web'
      },
      extension: {
        doc: 'The extension to use for cache files',
        format: String,
        default: 'html'
      }
    },
    redis: {
      enabled: {
        doc:
          'If enabled, cache files will be saved to the specified Redis server',
        format: Boolean,
        default: false
      },
      cluster: {
        doc: '',
        format: Boolean,
        default: false
      },
      host: {
        doc: 'The Redis server host',
        format: String,
        default: '127.0.0.1',
        env: 'REDIS_HOST'
      },
      port: {
        doc: 'The port for the Redis server',
        format: 'port',
        default: 6379,
        env: 'REDIS_PORT'
      },
      password: {
        doc: '',
        format: String,
        default: '',
        env: 'REDIS_PASSWORD'
      }
    }
  },
  headers: {
    useCompression: {
      doc:
        "If true, uses br or gzip compression where available and adds a 'Content-Encoding: [br|gzip]' header to the response.",
      format: Boolean,
      default: true
    },
    cacheControl: {
      doc:
        "A set of custom cache control headers for different content types. For example 'cacheControl': { 'text/css': 'public, max-age=1000' }",
      format: Object,
      default: {
        'image/png': 'public, max-age=86400',
        'image/jpeg': 'public, max-age=86400',
        'text/css': 'public, max-age=86400',
        'text/javascript': 'public, max-age=86400',
        'application/javascript': 'public, max-age=86400',
        'image/x-icon': 'public, max-age=31536000000'
      }
    }
  },
  logging: {
    enabled: {
      doc: 'If true, logging is enabled using the following settings.',
      format: Boolean,
      default: true
    },
    level: {
      doc: 'Sets the logging level.',
      format: ['debug', 'info', 'warn', 'error', 'trace'],
      default: 'info'
    },
    path: {
      doc: 'The absolute or relative path to the directory for log files.',
      format: String,
      default: './log'
    },
    filename: {
      doc: 'The name to use for the log file, without extension.',
      format: String,
      default: 'web'
    },
    extension: {
      doc: 'The extension to use for the log file.',
      format: String,
      default: 'log'
    },
    accessLog: {
      enabled: {
        doc:
          "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `web.access.log`.",
        format: Boolean,
        default: true
      },
      kinesisStream: {
        doc: 'An AWS Kinesis stream to write to log records to.',
        format: String,
        default: ''
      }
    },
    sentry: {
      dsn: {
        doc:
          "The 'DSN' to use for logging errors and events to a Sentry server. It should be similar to 'https://693ef18da3184cffa82144fde2979cbc:a0651b0286784761a62ef8e8fc128722@app.getsentry.com/59524'.",
        format: String,
        default: ''
      }
    }
  },
  globalEvents: {
    doc: 'Events to be loaded on every request.',
    format: Array,
    default: []
  },
  globalPostProcessors: {
    doc: 'Post-render processors to be run on every request.',
    format: Array,
    default: []
  },
  global: {
    doc: '',
    format: Object,
    default: {}
  },
  paths: {
    doc: '',
    format: Object,
    default: {
      datasources: path.join(installRoot, '/workspace/datasources'),
      events: path.join(installRoot, '/workspace/events'),
      processors: path.join(installRoot, '/workspace/processors'),
      middleware: path.join(installRoot, '/workspace/middleware'),
      pages: path.join(installRoot, '/workspace/pages'),
      public: path.join(installRoot, '/workspace/public'),
      routes: path.join(installRoot, '/workspace/routes'),
      tokenWallets: path.join(installRoot, '/.wallet')
    }
  },
  sessions: {
    enabled: {
      doc: '',
      format: Boolean,
      default: false
    },
    name: {
      doc: "The session cookie name. The default value is 'dadiweb.sid'",
      format: String,
      default: 'dadiweb.sid'
    },
    secret: {
      doc:
        'This is the secret used to sign the session ID cookie. This can be either a string for a single secret, or an array of multiple secrets. If an array of secrets is provided, only the first element will be used to sign the session ID cookie, while all the elements will be considered when verifying the signature in requests.',
      format: String,
      default: 'dadiwebsecretsquirrel',
      env: 'SESSION_SECRET'
    },
    resave: {
      doc:
        'Forces the session to be saved back to the session store, even if the session was never modified during the request.',
      format: Boolean,
      default: false
    },
    saveUninitialized: {
      doc:
        "Forces a session that is 'uninitialized' to be saved to the store. A session is uninitialized when it is new but not modified.",
      format: Boolean,
      default: false
    },
    store: {
      doc:
        'The session store instance, defaults to a new MemoryStore instance.',
      format: String,
      default: ''
    },
    cookie: {
      maxAge: {
        doc:
          "Set the cookie’s expiration as an interval of seconds in the future, relative to the time the browser received the cookie. Null means no 'expires' parameter is set so the cookie becomes a browser-session cookie. When the user closes the browser the cookie (and session) will be removed.",
        format: '*',
        default: 60000
      },
      secure: {
        doc: '',
        format: Boolean,
        default: false
      }
    }
  },
  rewrites: {
    datasource: {
      doc: '',
      format: String,
      default: ''
    },
    loadDatasourceAsFile: {
      doc: '',
      format: Boolean,
      default: false
    },
    datasourceRefreshTime: {
      format: Number,
      default: 5,
      doc: 'How often to refresh the datasource in minutes'
    },
    path: {
      doc: '',
      format: String,
      default: ''
    },
    forceLowerCase: {
      doc: 'If true, converts URLs to lowercase and redirects',
      format: Boolean,
      default: false
    },
    forceTrailingSlash: {
      doc: 'If true, adds a trailing slash to URLs and redirects',
      format: Boolean,
      default: false
    },
    stripIndexPages: {
      doc:
        "A set of filenames to remove from URLs. For example ['index.php', 'default.aspx']",
      format: Array,
      default: []
    },
    forceDomain: {
      doc: 'The domain to force requests to',
      format: String,
      default: ''
    }
  },
  security: {
    trustProxy: {
      doc:
        'If true, trusts the values specified in X-Forwarded-* headers, such as protocol and client IP address',
      format: '*',
      default: true
    },
    transportSecurity: {
      doc:
        'If true, requires requests to be secure. Overridden if server.protocol is set to https.',
      format: '*',
      default: false
    },
    csrf: {
      doc:
        'If true, a CSRF token will be provided, and all form submissions must include this as _csrf',
      format: '*',
      default: false
    }
  },
  uploads: {
    enabled: {
      doc:
        'If true, files uploaded via a form a saved to disk and added to `req.files`',
      format: Boolean,
      default: false
    },
    destinationPath: {
      doc: 'The destination directory for uploaded files',
      format: String,
      default: 'workspace/uploads'
    },
    hashFilename: {
      doc: 'If true, hashes the original filename using SHA1',
      format: Boolean,
      default: false
    },
    hashKey: {
      doc:
        'The key to use when hashing the filename, if `hashFilename` is true',
      format: String,
      default: ''
    },
    prefix: {
      doc:
        'If set, the uploaded file is prefixed with the specified value. Overrides "prefixWithFieldName".',
      format: String,
      default: ''
    },
    prefixWithFieldName: {
      doc: 'If true, the uploaded file is prefixed with the form field name',
      format: Boolean,
      default: false
    },
    whitelistRoutes: {
      doc: 'An array of routes which can accept file uploads',
      format: Array,
      default: []
    }
  },
  env: {
    doc: 'The applicaton environment.',
    format: String,
    default: 'development',
    env: 'NODE_ENV',
    arg: 'node_env'
  },
  virtualHosts: {
    doc: 'Allows serving multiple domains from a single instance of DADI Web',
    format: Object,
    default: {}
  },
  virtualDirectories: {
    doc:
      'Allows specifying folders where additional static content may reside. An array entry should like look { "path": "data/legacy_features", "index": "default.html", "forceTrailingSlash": false }',
    format: Array,
    default: []
  },
  allowJsonView: {
    doc:
      'If true, allows appending ?json=true to the querystring to view the raw JSON output for each page.',
    format: Boolean,
    default: false
  },
  allowDebugView: {
    doc:
      'If true, allows appending ?debug= to the querystring to view how the page is constructed,',
    format: Boolean,
    default: false
  },
  toobusy: {
    enabled: {
      doc:
        'If true, server will respond with HTTP 503 if the server is deemed too busy.',
      format: Boolean,
      default: false
    },
    maxLag: {
      doc:
        "The maximum amount of time in milliseconds that the event queue is behind before we consider the process 'too busy'.",
      format: Number,
      default: 70
    },
    interval: {
      doc: 'The time in milliseconds between each latency check.',
      format: Number,
      default: 500
    }
  },
  cluster: {
    doc:
      'If true, Web runs in cluster mode, starting a worker for each CPU core',
    format: Boolean,
    default: true
  },
  debug: {
    doc:
      'If true, debug mode is enabled and a panel containing the JSON loaded for each page is displayed alongside the normal content.',
    format: Boolean,
    default: false
  },
  data: {
    preload: {
      doc: 'An array of datasources to load at startup',
      format: Array,
      default: []
    }
  },
  engines: {
    doc: 'Engine-specific configuration parameters',
    format: Object,
    default: {}
  },
  status: {
    doc: '@dadi/status module options',
    format: Object,
    default: {}
  }
})

// Load environment dependent configuration
var env = conf.get('env')
conf.loadFile('./config/config.' + env + '.json')

// Load domain-specific configuration
conf.updateConfigDataForDomain = function (domain) {
  return new Promise((resolve, reject) => {
    var domainConfig = './config/' + domain + '.json'
    fs.stat(domainConfig, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        // No domain-specific configuration file
        return reject(err)
      }

      // no error, file exists
      conf.loadFile(domainConfig)

      return resolve()
    })
  })
}

module.exports = conf
module.exports.configPath = function () {
  var env = conf.get('env') || process.env['NODE_ENV']
  return './config/config.' + env + '.json'
}
