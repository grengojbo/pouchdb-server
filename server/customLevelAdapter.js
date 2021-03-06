'use strict';

const CoreLevelPouch = require('pouchdb-adapter-leveldb-core');

// create a PouchDb plugin from any *down database
const customLevelAdapter = (db) => {

  const CustomLevelPouch = (opts, callback) => {
    const _opts = Object.assign({
      db: db
    }, opts);

    CoreLevelPouch.call(this, _opts, callback);
  };

  CustomLevelPouch.valid = () => true;
  CustomLevelPouch.use_prefix = false;

  return function (PouchDB) {
    PouchDB.adapter('custom-leveldb', CustomLevelPouch, true);
  };
};

module.exports = customLevelAdapter;