"use strict";

const express  = require('express');
const favicon  = require('serve-favicon');
const path     = require('path');
const mkdirp   = require('mkdirp');
const nomnom   = require('nomnom');
const wordwrap = require('wordwrap');
const killable = require('killable');
const tailLog  = require('./logging');
const cors     = require('./cors');
// var Promise  = require('pouchdb-promise');
const customLevelAdapter = require('./customLevelAdapter');

const PouchDB  = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-replication'))
  .plugin(require('pouchdb-mapreduce'))
  .plugin(require('pouchdb-find'));

const terminalWrap = (text) => {
    // 26 chars from the left of the terminal might change when new
    // options are added
    return wordwrap(26, 80)(text).trim();
};

// parse command line arguments

const options = {
  port: {
    abbr: 'p',
    info: "Port on which to run the server.",
    couchName: ['httpd', 'port'],
    couchDefault: process.env.PORT || 5984,
    onChange: rebind
  },
  dir: {
    abbr: 'd',
    info: "Where to store database files.",
    couchName: ['couchdb', 'database_dir'],
    couchDefault: './',
    couchDefaultAlias: 'the current directory',
    onChange: updatePouchDB
  },
  config: {
    abbr: 'c',
    info: "The location of the configuration file that backs /_config.",
    ultimateDefault: './config.json'
  },
  host: {
    abbr: 'o',
    info: "The address to bind the server to.",
    couchName: ['httpd', 'bind_address'],
    couchDefault: process.env.HOST || '127.0.0.1',
    onChange: rebind
  },
  'in-memory': {
    abbr: 'm',
    info: "Use a pure in-memory database which will be deleted upon restart.",
    flag: true,
    couchName: ['pouchdb_server', 'in_memory'],
    couchDefault: false,
    onChange: updatePouchDB
  },
  proxy: {
    abbr: 'r',
    info: "Proxy requests to the specified host. Include a trailing '/'.",
    couchName: ['pouchdb_server', 'proxy'],
    onChange: updatePouchDB
  },
  'no-stdout-logs': {
    abbr: 'n',
    info: "Stops the log file from also being written to stdout.",
    flag: true,
    couchName: ['pouchdb_server', 'no-stdout-logs'],
    couchDefault: false,
    onChange: restartTailingLog
  },
  'no-color': {
    // this option is handled by the 'colors' node module. It's just
    // here so it shows up in --help
    flag: true,
    help: terminalWrap("Disable coloring of logging output.")
  },
  'level-backend': {
    info: (
      "Advanced - Alternate LevelDOWN backend (e.g. memdown, " +
      "riakdown, redisdown). Note that you'll need to manually npm " +
      "install it first."
    ),
    couchName: ['pouchdb_server', 'level_backend'],
    onChange: updatePouchDB
  },
  'level-prefix': {
    info: (
      "Advanced - Prefix to use for all database names, useful for " +
      "URLs in alternate backends, e.g. riak://localhost:8087/ for " +
      "riakdown."
    ),
    couchName: ['pouchdb_server', 'level_prefix'],
    onChange: updatePouchDB
  }
};

Object.keys(options).forEach(function (key) {
  const option = options[key];
  if (!option.help) {
    let d;
    if (option.couchName) {
      d = `/_config/${option.couchName.join("/")} which defaults to `;
      d += option.couchDefaultAlias || option.couchDefault;
    } else {
      d = option.ultimateDefault;
    }
    option.help = terminalWrap(`${option.info} (Defaults to ${d}).`);
  }
});

const args = nomnom
  .script('pouchdb-server')
  .options(options)
  .help([
    'Examples:',
    '',
    '  pouchdb-server --level-backend riakdown --level-prefix ' +
    'riak://localhost:8087',
    [
      "  Starts up a pouchdb-server that talks to Riak.",
      "  Requires: npm install riakdown"
    ].join('\n'),
    "",
    "  pouchdb-server --level-backend redisdown",
    [
      "  Starts up a pouchdb-server that talks to Redis, on localhost:6379.",
      "  Requires: npm install redisdown"
    ].join('\n')
  ].join('\n'))
  .nocolors()
  .parse();

// build app

const app = express();

const pouchDBApp = require('express-pouchdb')({
  configPath: getArg('config')
});

function getArg(name) {
  if (options[name].couchName) {
    return args[name] || config.get.apply(config, options[name].couchName);
  } else {
    return args[name] || options[name].ultimateDefault;
  }
}

const config = pouchDBApp.couchConfig;
const logger = pouchDBApp.couchLogger;

// register defaults & change listeners
Object.keys(options).forEach(function (key) {
  const option = options[key];

  if (typeof option.couchDefault !== 'undefined') {
    const args = option.couchName.concat([option.couchDefault]);
    config.registerDefault.apply(config, args);
  }
  if (option.onChange) {
    config.on(option.couchName.join('.'), option.onChange);
  }
});

// favicon
app.use(favicon(__dirname + '/../favicon.ico'));

// logging
let stopTailingLog, loggingReady;

function restartTailingLog() {
  if (stopTailingLog) {
    stopTailingLog();
    stopTailingLog = undefined;
  }
  if (getArg('no-stdout-logs')) {
    loggingReady = Promise.resolve();
  } else {
    loggingReady = tailLog(config.get('log', 'file')).then((stop) => {
      stopTailingLog = stop;
    });
  }
}

config.on('log.file', restartTailingLog);
restartTailingLog();

// cors
app.use(cors(config));

// determine PouchDB instance
function updatePouchDB() {
  let opts = {};

  opts.prefix = path.resolve(getArg('dir')) + path.sep;
  mkdirp.sync(opts.prefix);

  if (getArg('level-prefix')) {
    opts.prefix = getArg('level-prefix');
  }
  if (getArg('in-memory')) {
    PouchDB.plugin(require('pouchdb-adapter-memory'));
  } else if (getArg('level-backend')) {
    PouchDB.plugin(customLevelAdapter(require(getArg('level-backend'))));
  } else {
    PouchDB.plugin(require('pouchdb-adapter-leveldb'));
  }

  let ThisPouchDB;
  if (getArg('proxy')) {
    ThisPouchDB = require('http-pouchdb')(PouchDB, getArg('proxy'));
  } else {
    ThisPouchDB = PouchDB.defaults(opts);
  }
  pouchDBApp.setPouchDB(ThisPouchDB);
}

updatePouchDB();

app.use(pouchDBApp);

// health check
app.get('/healthz', (req, res) => {
  res.sendStatus(200);
  // res.setHeader('', '');
  res.type('text/plain').send('Ok');
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res) => {
    res.status(err.status || 500);
    res.send();
  });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res) => {
    res.status(err.status || 500);
    res.send();
});

// handle listening
let server;

function listen() {
  loggingReady.then(listenImpl);
}

function listenImpl() {
  const host = getArg('host');
  let port = getArg('port');
  if (typeof port !== 'number') {
    logger.warning('port must be an integer.');
    port = options.port.couchDefault;
  }

  server = app.listen(port, host, () => {
    const address = `http://${host}:${port}/`;
    logger.info(`pouchdb-server has started on ${address}`);
    if (getArg('proxy')) {
      logger.info(`database is a proxy to ${getArg('proxy')}`);
    } else if (getArg('in-memory')) {
        logger.info('database is in-memory; no changes will be saved.');
    }
    if (getArg('dir') !== options.dir.couchDefault) {
      logger.info('database files will be saved to ' + getArg('dir'));
    }
    if (getArg('level-backend')) {
      logger.info(`using alternative backend: ${getArg('level-backend')}`);
    }
    const prefix = getArg('level-prefix');
    if (prefix) {
      logger.info(`all databases will be created with prefix: ${prefix}`);
    }
    const fauxtonUrl = `${address}_utils`;
    logger.info(`navigate to ${fauxtonUrl} for the Fauxton UI.`);
  });

  killable(server);

  server.on('error', (e) => {
    stopTailingLog();
    if (e.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use.`);
      console.error(`Try another one, e.g. pouchdb-server -p ${parseInt(port) + 1}`);
    } else {
      console.error(`Uncaught error: ${e}`);
      console.error(e.stack);
    }
  });
}

function rebind() {
  server.kill(listen);
}

listen();

// handle exit

process.on('SIGINT', () => {
  process.exit(0);
});

// graceful shutdown
// const callbackToPromise = require('promise-callback')
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received');
    process.exit(0);
//
//     // close server first
//     callbackToPromise(app.close)
//     // than db(s)
//         .then(() => redis.disconnect())
//         // exit process
//         .then(() => {
//             logger.info('Succesfull graceful shutdown')
//             process.exit(0)
//         })
//         .catch((err) => {
//             logger.error('Server close')
//             process.exit(-1)
//         })
})