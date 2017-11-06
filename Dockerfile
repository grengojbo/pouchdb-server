FROM node:8-alpine

ENV PORT 5984
ENV HOST 0.0.0.0
ENV appDir /app

EXPOSE ${PORT}

RUN mkdir ${appDir}
RUN mkdir ${appDir}/logs
RUN mkdir /data

WORKDIR ${appDir}

VOLUME /data

ADD add-db-user.sh /usr/bin/add-db-user.sh
RUN chmod +x /usr/bin/add-db-user.sh

COPY server/config.example.json ${appDir}/config.json

ADD package.json ${appDir}/
ADD bin ${appDir}/

ENV PATH ${appDir}/bin:${PATH}

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
  npm install --no-package-lock --production && \
  apk del .build-deps

#  npm install --production -g pouchdb-server -q && \



CMD ["/app/bin/pouchdb-server", "--dir", "/data", "-c", "/app/config.json"]