"use strict";

const Tail = require('tail').Tail;
const LogParser = require('couchdb-log-parse');
const colors = require('colors/safe');
const fs = require('fs');

const parser = new LogParser();
parser.on('message', (msg) => {
  const args = [fmtLevel(msg.level)];
  if (msg.type === "http") {
    args.push(msg.method, msg.url, fmtStatusCode(msg.statusCode));
    args.push('-', colors.white(msg.ip));
  } else if (msg.type === "erl") {
    args.push((msg.message || '').trim(), msg.dump);
  } else {
    args.push((msg.raw || '').trim());
  }
  console.log.apply(console, args);
});

const levelColor = (level) => {
    return {
        info: colors.green,
        debug: colors.cyan,
        error: colors.red,
        warning: colors.yellow
    }[level] || function (text) {
        // no color
        return text;
    };
};

const fmtLevel = (level) => {
  const text = '[' + (level || 'other') + ']';
  return levelColor(level)(text);
};

const fmtStatusCode = (statusCode) => statusCodeColor(statusCode)(statusCode);

const statusCodeColor = (status) => {
  if (status >= 500) {
    return colors.red;
  }
  if (status >= 400) {
    return colors.yellow;
  }
  if (status >= 300) {
    return colors.cyan;
  }
  return colors.green;
};

module.exports = function tailLog(path) {
  // Watches a couchdb style log file, when a new line gets available it
  // is parsed. The interesting info in it is then pretty printed to
  // stdout as parser output.

  const startTailing = () => {
    return new Promise((resolve) => {
      fs.exists(path, (exists) => {
        if (!exists) {
          // try again in a bit
          return resolve(startTailing());
        }
        const tail = new Tail(path);
        tail.on('line', (line) => {
          // double \n is necessary for the line to be processed.
          parser.write(new Buffer(line + '\n\n', 'UTF-8'));
        });
        resolve(tail.unwatch.bind(tail));
      });
    });
  };

  return startTailing();
};
