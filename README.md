# Gist-Reveal.it
[![Build Status](http://img.shields.io/travis/ryanj/gist-reveal.it.svg)](https://travis-ci.org/ryanj/gist-reveal.it) [![Build Status](http://img.shields.io/jenkins/s/https/build-shifter.rhcloud.com/slide-build.svg)](https://build-shifter.rhcloud.com/job/slide-build/) [![Dependency Check](http://img.shields.io/david/ryanj/gist-reveal.it.svg)](https://david-dm.org/ryanj/gist-reveal.it) [![Gitter Chat](https://badges.gitter.im/Chat.svg)](https://gitter.im/ryanj/gist-reveal.it?utm_source=badge)

[![Launch on OpenShift](http://launch-shifter.rhcloud.com/launch/LAUNCH ON.svg)](https://openshift.redhat.com/app/console/application_type/custom?&cartridges[]=nodejs-0.10&initial_git_url=https://github.com/ryanj/gist-reveal.it.git&name=slides)

[Gist-Reveal.it](http://gist-reveal.it/) is an open source slideshow templating service that makes it easy to create, edit, present, and share [Reveal.js](https://github.com/hakimel/reveal.js) slides on the web.

Just store any Revealjs-compatible [HTML](https://github.com/hakimel/reveal.js#markup) or [Markdown](https://github.com/hakimel/reveal.js#markdown) content in a github gist, then add the resulting gist id to the end of any gist-reveal site url to view the resulting templated presentation.

Conference organizers can host their own modified gist-reveal templating service to provide a consistent slideshow theme for all of the presentations at their event:

 * [gist-reveal.it](http://gist-reveal.it/af84d40e58c5c2a908dd)
 * [dockercon-slides.com](http://dockercon-slides.com/af84d40e58c5c2a908dd)

### Application Config

The following environment variables can be used to autoconfigure the application:

Variable Name  | Contents   |  Default Value
---------------|------------|---------------
DEFAULT_GIST   | The default gist id slideshow content for the site | af84d40e58c5c2a908dd
GH_CLIENT_SECRET | GitHub client secret | unset
GH_CLIENT_ID | GitHub client ID | unset
GA_TRACKER | Google Analytics tracker token | unset
PORT | The server port number | 8080
IP_ADDR | The server IP address | 0.0.0.0
REVEAL_THEME | The site's default theme. Should be a locally bundled theme name, or a remote gist_id. | 60e54843de11a545897e
GIST_THEMES | Allow reveal.js CSS themes to be installed dynamically "url/?theme=gist_id". Disable this feature by setting this config to the string "false". | "true"
REVEAL_WEB_HOST | The site's hostname | localhost
REVEAL_SOCKET_SECRET | the site's broadcast token (alphanumeric) | randomly generated

See [`plugin/hosted/index.js`](https://github.com/ryanj/gist-reveal.it/edit/master/plugin/hosted/index.js) for more information about the site's configuration options.

### Broadcasting Slide Transitions

Administrators can configure the application's `REVEAL_SOCKET_SECRET` to broadcast slide transitions using Reveal's [socket Multiplexing support](https://github.com/hakimel/reveal.js#multiplexing).

Presenters who know the site's `REVEAL_SOCKET_SECRET` value can configure their browser as a presentation device using the `setToken` querystring param:

    http://YOUR_REVEAL_HOST_URL/?setToken=REVEAL_SOCKET_SECRET_VALUE

This token will be stored in the browser's `localStorage` area (per host url) as `localStorage.secret`. To reconfigure your browser as a client device (as a listener), use the `clearToken` querystring param:

    http://YOUR_REVEAL_HOST_URL/?clearToken

### Local Development

Start this project locally by running `npm install` followed by `npm start`.

## OpenShift Hosting

This application can be launched on any OpenShift cloud using the `rhc` command-line tool:

```bash
rhc app create gistreveal nodejs-0.10 \
--from code=http://github.com/ryanj/gist-reveal.it \ 
DEFAULT_GIST=YOUR_DEFAULT_GIST_ID \ 
GH_CLIENT_SECRET=YOUR_GH_CLIENT_SECRET \ 
GH_CLIENT_ID=YOUR_GH_CLIENT_ID \ 
REVEAL_SOCKET_SECRET=0P3N-S0URC3 \ 
GA_TRACKER=YOUR_GA_TRACKER
```

Or, [click here to launch on the web](https://openshift.redhat.com/app/console/application_types/custom?name=reveal&initial_git_url=https%3A%2F%2Fgithub.com/ryanj/gist-reveal.it.git&cartridges[]=nodejs-0.10)!

Then, use the `rhc env set` command to publish [configuration strings](#application-config) into the application's system environment.

## Docker 

To run [the docker image](https://registry.hub.docker.com/u/ryanj/gist-reveal.it/) locally on port `8080`:

    docker pull ryanj/gist-reveal.it
    docker run -d -p 8080:8080 ryanj/gist-reveal.it

[Environment variables](#Application_Config) can be passed into the Docker container in order to configure the websocket relay, or to change the default slideshow content: 

    docker run -e "REVEAL_WEB_HOST=YOUR_HOSTNAME_HERE" -e "REVEAL_SOCKET_SECRET=0P3N-S0URC3" -e "DEFAULT_GIST=YOUR_DEFAULT_GIST_ID" ryanj/gist-reveal.it
    
### OpenShiftM5 & Kubernetes 

A [sample kubernetes pod configuration file](https://github.com/ryanj/gist-reveal.it/blob/master/reveal-pod.json) is included for running [this project's Docker build](https://registry.hub.docker.com/u/ryanj/gist-reveal.it/) on [an OriginM5 hosting environment](https://github.com/openshift/origin#getting-started):

```bash
export DEFAULT_GIST=YOUR_DEFAULT_GIST_ID 
export IP_ADDR=0.0.0.0
export OPENSHIFT_APP_DNS=gist-reveal.it
export GH_CLIENT_SECRET=YOUR_GH_CLIENT_SECRET 
export GH_CLIENT_ID=YOUR_GH_CLIENT_ID
export REVEAL_SOCKET_SECRET=0P3N-S0URC3 
export GA_TRACKER=YOUR_GA_TRACKER
$GOPATH/src/github.com/openshift/origin/_output/go/bin/openshift kube create pods -c ~/src/gist-reveal.it/reveal-pod.json
```

To build and deploy your own Docker image for Gist-Reveal.It on OpenShiftM5, use the file `k8s/reveal-dockerbuild.json` as follows.

- Make sure OpenShift is running with a local Docker registry, and obtain the IP address of the registry with a command such as `osc get services`. It will likely have the form 172.30.17.x.
- Update `k8s/reveal-dockerbuild.json`, replacing all references to `172.30.17.x` with the IP of your local Docker registry.
- If you have forked this repository and wish to build from your copy, update `https://github.com/ryanj/gist-reveal.it.git` in `reveal-dockerbuild.json` to point to your fork.
- Run a command such as the following to process and apply the configuration. Include values for any config parameters you wish to set/override:

```
osc process -f reveal-stibuild.json -v DEFAULT_GIST=${DEFAULT_GIST},GH_CLIENT_ID=${GH_CLIENT_ID},GH_CLIENT_SECRET=${GH_CLIENT_SECRET},REVEAL_SOCKET_SECRET=${REVEAL_SOCKET_SECRET} | osc apply -f -
```

- Run the following command to trigger a build.

```
curl -X POST http://localhost:8080/osapi/v1beta1/buildConfigHooks/gist-reveal-build/secret101/generic
```

- To view the logs for the build, use `osc get builds` to find its name, and supply that name to the command `osc build-logs`. For example: `osc build-logs 4af7a5cd-8b21-11e4-85b4-853a4bcdbfe0`.
- When the build is complete, you should be able to view Gist-Reveal.It in your browser at the IP address found in the output of `osc get services`.

## License

[gist-reveal,it](http://gist-reveal.it/) was created at the first [DockerCon Hackathon](http://blog.docker.com/2014/07/dockercon-video-dockercon-hackathon-winners/) by [@ryanj](https://github.com/ryanj) and [@fkautz](https://github.com/fkautz).

[Reveal.js](https://github.com/hakimel/reveal.js) is MIT licensed
Copyright (C) 2014 Hakim El Hattab, http://hakim.se
