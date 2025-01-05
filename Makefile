
registry = docker.io
docker_cli = podman
user = ryanj
tag = latest
latest_img_id = $(shell $(docker_cli) images -q $(registry)/$(user)/gist-reveal:latest)

# make
all: build

# make build user=fkautz docker_cli=docker
build:
	$(docker_cli) build --arch=amd64 -t $(registry)/$(user)/gist-reveal:latest .

# make tag tag=x.y.z
tag:
ifeq ($(tag), latest)
	@echo error: tag required
	@echo try: 'make tag tag=x.y.z'
else ifneq ($(latest_img_id),)
	$(docker_cli) tag $(latest_img_id) $(registry)/$(user)/gist-reveal:$(tag)
else
	@echo error: run 'make build' first
endif

# make publish tag=x.y.z
push publish:
	@echo publishing tag=$(tag) to $(registry)/$(user)/gist-reveal
	$(docker_cli) push $(registry)/$(user)/gist-reveal:$(tag)
	@echo published: $(registry)/$(user)/gist-reveal:$(tag)

# make run
run:
	$(docker_cli) run --rm -p 8080:8080 -e "DEBUG=1" $(registry)/$(user)/gist-reveal:$(tag)

node_modules:
	npm install

# make dev
dev: node_modules
	DEBUG=1 npm start

# make clean
clean:
	rm -Rf node_modules css/theme/gists
ifneq ($(tag),latest)
	$(docker_cli) rmi $(registry)/$(user)/gist-reveal:$(tag)
endif
ifneq ($(latest_img_id),)
	$(docker_cli) rmi $(latest_img_id)
endif
