# pouchdb-server

An image based on iojs:slim with pouchdb server and leveldown database.


[info] navigate to http://10.10.10.14:5984/_utils for the Fauxton UI.

RUN:

```bash
docker run -d -v /data/pouchdb/:/pouchdb --hostname="pouchdb-server" --name="pouchdb-server" -p 0.0.0.0:5984:5984 rstiller/pouchdb-server
```

ADD an user:

```bash
docker exec -it pouchdb-server add-db-user.sh <username>

```
