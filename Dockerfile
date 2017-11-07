FROM node:8-slim

ENV PORT 5984
ENV HOST "0.0.0.0"
ENV appDir /app
#ENV NODE_ENV production

EXPOSE ${PORT}

RUN mkdir ${appDir}
RUN mkdir ${appDir}/logs
RUN mkdir /data

WORKDIR ${appDir}

VOLUME /data
VOLUME ${appDir}/logs

ADD package.json ${appDir}/
ADD bin ${appDir}/bin

ENV PATH ${appDir}/bin:${PATH}
ENV NPM_CONFIG_LOGLEVEL warn
#USER node

RUN apt-get -qq update && \
    apt-get -y --no-install-recommends install g++ python make git wget apt-utils && \
    npm install --no-package-lock --production && \
    apt-get -y purge g++ make python git apt-utils && \
    apt-get -y autoremove && \
    apt-get -y autoclean

ADD config.example.json ${appDir}/config.json
ADD favicon.ico ${appDir}/favicon.ico
ADD add-db-user.sh /usr/bin/add-db-user.sh
RUN chmod +x /usr/bin/add-db-user.sh

ADD server ${appDir}/server


CMD ["/app/bin/pouchdb-server", "--dir", "/data", "--no-color", "-o", "0.0.0.0", "-c", "/app/config.json"]
#CMD ["/app/node_modules/pouchdb-server/bin/pouchdb-server", "--dir", "/data", "-o", "0.0.0.0", "-c", "/app/config.json"]
#CMD ["/app/bin/pouchdb-server", "--dir", "/data", "-c", "/app/config.json"]
