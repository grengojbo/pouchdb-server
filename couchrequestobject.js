"use strict";

var Promise = require("lie");
var extend = require("extend");

var is = require("is");
var buildUserContextObject = require("./couchusercontextobject.js");
var buildSecurityObject = require("./couchsecurityobject.js");

module.exports = function buildRequestObject(options, pathPromise, infoPromise, db) {
  var userCtxPromise = infoPromise.then(buildUserContextObject);
  var uuidPromise = db.id();

  return Promise.all([pathPromise, infoPromise, userCtxPromise, uuidPromise]).then(function (args) {
    //add the options in the front & pass on
    args.unshift(options);
    return actuallyBuildRequestObject.apply(null, args);
  });
};

function actuallyBuildRequestObject(options, path, info, userCtx, uuid) {
  //documentation: http://couchdb.readthedocs.org/en/latest/json-structure.html#request-object
  var result = {
    body: "undefined",
    cookie: {},
    form: {},
    headers: {
      "Host": "localhost:5984",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": buildAcceptLanguage(),
      "User-Agent": buildUserAgent()
    },
    info: info,
    method: "GET",
    path: path.slice(0),
    peer: "127.0.0.1",
    query: {},
    requested_path: path.slice(0),
    raw_path: "/" + path.join("/"),
    secObj: buildSecurityObject(),
    userCtx: userCtx,
    uuid: uuid
  };
  if (["_show", "_update"].indexOf(path[3]) === -1) {
    result.id = null;
  } else {
    result.id = path[5] || null;
    if (result.id === "_design" && path[6]) {
      result.id += "/" + path[6];
    }
  }

  if (options.format) {
    result.query.format = options.format;
  }

  extend(true, result, options.reqObjStub || {});

  //add query string to requested_path if necessary
  var i = result.requested_path.length - 1;
  var pathEnd = result.requested_path[i];
  if (!is.empty(result.query) && pathEnd.indexOf("?") === -1) {
    result.requested_path[i] = pathEnd + "?" + serialize(result.query);
  }
  //add query string to raw_path if necessary
  if (!is.empty(result.query) && result.raw_path.indexOf("?") === -1) {
    result.raw_path += "?" + serialize(result.query);
  }

  //update body based on form & add content-type & content-length
  //header accordingly if necessary. Also switch to POST (most common
  //if not already either POST, PUT or PATCH.
  if (!is.empty(result.form) && result.body === "undefined") {
    result.body = serialize(result.form);
    result.headers["Content-Type"] = "application/x-www-form-urlencoded";
    result.headers["Content-Length"] = result.body.length.toString();
    if (["POST", "PUT", "PATCH"].indexOf(result.method) === -1) {
      result.method = "POST";
    }
  }

  return result;
}

function buildAcceptLanguage() {
  //An Accept-Language header based on
  //1) the browser language
  //2) a default (i.e. English)
  var lang = (global.navigator || {}).language || (global.navigator || {}).userLanguage;
  lang = (lang || "en").toLowerCase();
  if (["en", "en-us"].indexOf(lang) !== -1) {
    return "en-us,en;q=0.5";
  } else {
    return lang + ",en-us;q=0.7,en;q=0.3";
  }
}

function buildUserAgent() {
  //if running in a browser, use its user agent.
  var ua = (global.navigator || {}).userAgent;
  return ua || "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:28.0) Gecko/20100101 Firefox/28.0";
}

function serialize(obj) {
  var result = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      result.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]));
    }
  }
  return result.join("&");
}
