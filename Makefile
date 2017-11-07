#
# Makefile for this application
#
USER_NAME=grengojbo
ADMIN_USER=grengojbo
PROJECT=$(shell basename $(abspath ./))
PROJECT_DIR=$(shell pwd)
TAG_VERSION=$(shell cat VERSION)
#TAG=gcr.io/$(PROJECT)/sukie:$(TAG_VERSION)
#TAG=g${USER_NAME}/$(PROJECT):$(TAG_VERSION)
TAG=${USER_NAME}/$(PROJECT)-dev:$(TAG_VERSION)
NAME=pouchdb-server
# where the ssh port is redirected
SSH_PORT=$(word 2,$(subst :, ,$(shell docker port $(NAME) 22)))
#the id of the docker group
DOCKER_GID=$(word 3,$(subst :, ,$(shell getent group docker)))
#default web port
PORT=5984
PUB_PORT=5984
URL=$(shell dinghy ip)
#eval $(dinghy env)

run: chrome
	./bin/pouchdb-server --dir $(PROJECT_DIR)/db -o 0.0.0.0 -c $(PROJECT_DIR)/config.json

# build the docker image|
#build: deps
build:
	docker build --tag=$(TAG) .

clean:
	docker rmi -f $(TAG)

# push the docker image up to the Google Container repository
push:
	docker push $(TAG)

# install all the node dependencies
deps:
	npm install --production

# run the nodejs application
serve:
	@echo "RUN command line: open http://$(URL):$(PORT)/_utils"
	@docker run --rm -p=$(PORT) -v $(PROJECT_DIR)/db:/data -v $(PROJECT_DIR)/config.json:/app/config.json -p $(PUB_PORT):$(PORT) -e "NODE_ENV=production" --name=$(NAME) $(TAG)

stop-docker:
	docker stop $(NAME)

# show what your project is. Useful debugging.
project:
	@echo $(PROJECT)
	@echo TAG: $(TAG)

# Open Chrome up to the right exposed port from the docker shell.
chrome:
	open http://localhost:$(PORT)/_utils

# Start the developer shell
#shell:
#	mkdir -p ~/.config/gcloud
#	mkdir -p `pwd`/.kube
#	docker run --rm \
#		--name=$(NAME) \
#		-p=8001:8001 \
#		-p=8002:8002 \
#		-P=true \
#		-e TERM \
#		-e HOST_GID=`id -g` \
#		-e HOST_UID=`id -u` \
#		-e HOST_USER=$(USER) \
#		-e DOCKER_GID=$(DOCKER_GID) \
#		-v ~/.config/gcloud:/home/$(USER)/.config/gcloud \
#		-v ~/.appcfg_oauth2_tokens:/home/$(USER)/.appcfg_oauth2_tokens \
#		-v `pwd`/.kube:/home/$(USER)/.kube \
#		-v `pwd`/dev/nanorc:/home/$(USER)/.nanorc \
#		-v `pwd`/dev/zshrc:/home/$(USER)/.zshrc \
#		-v /usr/bin/docker:/usr/bin/docker \
#		-v /var/run/docker.sock:/var/run/docker.sock \
#		-v `pwd`:/project \
#		-it $(TAG) /root/startup.sh

# Attach a new terminal to an already running dev shell
shell-attach:
	docker exec -it --user=$(USER) $(NAME) zsh

# Attach a root terminal to an already running dev shell
shell:
	docker run -it --rm -v $(PROJECT_DIR)/db:/data $(TAG) sh
