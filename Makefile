# default options:
docker_cli = podman
registry = docker.io
user = ryanj
image = gist-reveal
tag = latest
arch = amd64
SHELL=/bin/bash

# make
all: build

# make build user=fkautz docker_cli=docker
build:
	$(docker_cli) build --platform=linux/$(arch) -t $(registry)/$(user)/$(image):latest .

# make tag tag=x.y.z
tag: build
ifeq ($(tag), latest)
	@echo error: tag required
	@echo try: 'make tag tag=x.y.z'
else
	$(docker_cli) tag $$($(docker_cli) images -q $(registry)/$(user)/$(image):latest) $(registry)/$(user)/$(image):$(tag)
endif

# make publish tag=x.y.z
push publish:
	@echo publishing tag=$(tag) to $(registry)/$(user)/$(image)
	$(docker_cli) push $(registry)/$(user)/$(image):$(tag)
	@echo published: $(registry)/$(user)/$(image):$(tag)

# make run
run:
	$(docker_cli) run --rm -p 8080:8080 -e "DEBUG=1" $(registry)/$(user)/$(image):$(tag)

# make dev
dev: node_modules
	DEBUG=1 npm start

# make clean tag=x.y.z
clean:
	rm -Rf node_modules css/theme/gists public.crt private.key
ifneq ($(tag),latest)
	$(docker_cli) rmi $(registry)/$(user)/$(image):$(tag)
endif
ifneq (,$(shell $(docker_cli) images -q $(registry)/$(user)/$(image):latest))
	$(docker_cli) rmi -f $$($(docker_cli) images -q $(registry)/$(user)/$(image):latest)
endif

node_modules:
	npm install

public.crt private.key:
	openssl req -x509 -out public.crt -keyout private.key \
	-newkey rsa:2048 -nodes -sha256 \
	-subj '/CN=localhost' -extensions EXT -config <(printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")

-include Makefile.local
