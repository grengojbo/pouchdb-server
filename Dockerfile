FROM node:8-alpine

ENV PORT 5984
ENV HOST 0.0.0.0
ENV appDir /app

EXPOSE ${PORT}

RUN mkdir ${appDir}

WORKDIR ${appDir}

ADD add-db-user.sh /usr/bin/add-db-user.sh
RUN chmod +x /usr/bin/add-db-user.sh

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
  npm install pouchdb-server && \
  apk del .build-deps

#  npm install --production -g pouchdb-server -q && \

COPY server/config.json ${appDir}/config.json


CMD ["pouchdb-server", "--dir", "${appDir}/db", "-o", "${HOST}", "-c", "${appDir}/config.json"]