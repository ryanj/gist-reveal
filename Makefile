
docker_cmd = podman
docker_user = ryanj
tag = latest
latest_img_id = $(shell $(docker_cmd) images -q $(docker_user)/gist-reveal:latest)

# make build
build:
	$(docker_cmd) build --arch=amd64 -t $(docker_user)/gist-reveal:$(tag) .

# make tag tag=x.y.z
tag:
ifeq ($(tag), latest)
	echo "error: tag required"
else
	$(docker_cmd) tag $(latest_img_id) $(docker_user)/gist-reveal:$(tag)
endif

# make publish tag=x.y.z
publish:
ifeq ($(tag), latest)
	echo "error: tag required"
else
	$(docker_cmd) push $(docker_user)/gist-reveal:$(tag)
endif

# make run
run:
	$(docker_cmd) run --rm -p 8080:8080 -e "DEBUG=1" $(docker_user)/gist-reveal:$(tag)

# make clean
clean:
	$(docker_cmd) rmi $(latest_img_id)
