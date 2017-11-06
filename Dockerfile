FROM node:8-alpine

ENV PORT 5984
ENV HOST 0.0.0.0
ENV appDir /app

EXPOSE ${PORT}

RUN mkdir ${appDir}
RUN mkdir /data

WORKDIR ${appDir}

VOLUME /data

ADD add-db-user.sh /usr/bin/add-db-user.sh
RUN chmod +x /usr/bin/add-db-user.sh

COPY server/config.json ${appDir}/config.json

ADD package.json ${appDir}/
ADD bin ${appDir}/

RUN apk add --no-cache --virtual .build-deps \
    binutils-gold \
    curl \
    g++ \
    gcc \
    gnupg \
    libgcc \
    linux-headers \
    make \
    python && \
  npm install && \
  apk del .build-deps

#  npm install --production -g pouchdb-server -q && \



CMD ["${appDir}/bin/pouchdb-server", "--dir", "/data", "-o", "${HOST}", "-c", "${appDir}/config.json"]