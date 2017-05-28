# Gist-Reveal
[![Build Status](http://img.shields.io/travis/ryanj/gist-reveal.svg)](https://travis-ci.org/ryanj/gist-reveal) [![Build Status](http://img.shields.io/jenkins/s/https/build-shifter.rhcloud.com/slide-build.svg)](https://build-shifter.rhcloud.com/job/slide-build/) [![Dependency Check](http://img.shields.io/david/ryanj/gist-reveal.svg)](https://david-dm.org/ryanj/gist-reveal) [![Gitter Chat](https://badges.gitter.im/Chat.svg)](https://gitter.im/ryanj/gist-reveal.it?utm_source=badge)

## Gist-powered Revealjs presentations

[Gist-Reveal.it](http://gist-reveal.it/) is an open source slideshow templating service that makes it easy to create, edit, present, and share [Reveal.js](https://github.com/hakimel/reveal.js) slides on the web by using github's [gist](http://gist.github.com) service as a datastore.

#### gist-reveal.it/YOUR_GIST_ID

Store any Revealjs-compatible [HTML](https://github.com/hakimel/reveal.js#markup) or [Markdown](https://github.com/hakimel/reveal.js#markdown) content in a [gist](http://gist.github.com), then [append your resulting gist id to the end of any gist-reveal site url](http://gist-reveal.it/af84d40e58c5c2a908dd#/try-it) to view the resulting presentation:

    http://gist-reveal.it/GIST_ID_CONTAINING_REVEALJS_SLIDE_CONTENT
    
Example:

    http://gist-reveal.it/af84d40e58c5c2a908dd

Use [bitly](http://bit.ly) or another url shortener to make these long urls easier to share, and to make enagement rates easier to count.

#### gist-reveal.it/bit.ly/SHORTNAME

Creating a [bit.ly](http://bit.ly) shortname for your longer `gist-reveal/gist_id` deck urls will also make your presentations available at an alternate presentation path:

    http://gist-reveal.it/bit.ly/SHORTNAME
    
Example:

    http://gist-reveal.it/bit.ly/k8s-workshops
    
Much nicer!  Make sure to continue sending traffic to the shorter `bit.ly/shortname` url for metrics collection purposes.

## Gist-powered Slideshow Themes

Available CSS themes include [the default reveal.js list of themes](http://lab.hakim.se/reveal-js/#/themes), but can be easily extended by storing new themes [in a gist](https://gist.github.com/450836bbaebcf4c4ae08b331343a7886):

 * [a theme from the CoreOS team](http://gist-reveal.it/?theme=450836bbaebcf4c4ae08b331343a7886#/themes)
 * [a theme for OpenShift fans](http://gist-reveal.it/?theme=60e54843de11a545897e#/themes)
 * [the revealjs black theme](http://gist-reveal.it/?theme=black#/themes)
 * [the revealjs simple theme](http://gist-reveal.it/?theme=simple#/themes)
 * [the revealjs league theme](http://gist-reveal.it/?theme=default#/themes)
 * [the revealjs sky theme](http://gist-reveal.it/?theme=sky#/themes)

Conference organizers can host their own modified gist-reveal templating service (with it's own default theme), to provide a consistent look for all presentations at an event.

### Application Config

The following environment variables can be used to autoconfigure the application:

Variable Name  | Contents   |  Default Value
---------------|------------|---------------
DEFAULT_GIST   | The default gist id slideshow content for the site | [af84d40e58c5c2a908dd](https://gist.github.com/ryanj/af84d40e58c5c2a908dd)
REVEAL_THEME | The site's default theme. Should be a locally bundled theme name, or a remote gist_id. | [450836bbaebcf4c4ae08b331343a7886](https://gist.github.com/ryanj/450836bbaebcf4c4ae08b331343a7886) 
GH_CLIENT_SECRET | GitHub client secret | unset
GH_CLIENT_ID | GitHub client ID | unset
GA_TRACKER | Google Analytics tracker token | unset
PORT | The server port number | 8080
IP_ADDR | The server IP address | 0.0.0.0
GIST_THEMES | Allow reveal.js CSS themes to be installed dynamically "url/?theme=gist_id". Disable this feature by setting this config to the string "false". | "true"
REVEAL_SOCKET_SECRET | the site's broadcast token (alphanumeric) | randomly generated

See [`plugin/hosted/index.js`](https://github.com/ryanj/gist-reveal.it/edit/master/plugin/hosted/index.js) for more information about the site's configuration options.

### Broadcasting Slide Transitions

Administrators can configure the application's `REVEAL_SOCKET_SECRET` to broadcast slide transitions using Reveal's [socket Multiplexing support](https://github.com/hakimel/reveal.js#multiplexing).

Presenters who know the site's `REVEAL_SOCKET_SECRET` value can configure their browser as a presentation device using the `setToken` querystring param:

    http://YOUR_REVEAL_HOST_URL/?setToken=REVEAL_SOCKET_SECRET_VALUE

This token will be stored in the browser's `localStorage` area (per host url) as `localStorage.secret`. To reconfigure your browser as a client device (as a listener), use the `clearToken` querystring param:

    http://YOUR_REVEAL_HOST_URL/?clearToken

## Running Gist-Reveal.it
Gist-reveal makes it easy to run your own Gist-powered RevealJS slideshow service

### Local Development

The simplest way to get started with this project, is to clone a copy of the source from github (`git clone http://github.com/ryanj/gist-reveal && cd gist-reveal`), then run the app locally with `npm install` followed by `npm start`.

### Kubernetes 
To create a kubernetes `deployment` and `NodePort` `service`, both named `gist-reveal`:

```bash
kubectl run gist-reveal --image=ryanj/gist-reveal --expose --port=8080 --service-overrides='{ "spec": { "type": "NodePort" } }' \
--env="DEFAULT_GIST=YOUR_DEFAULT_GIST_ID" \
--env="GH_CLIENT_SECRET=YOUR_GH_CLIENT_SECRET" \
--env="GH_CLIENT_ID=YOUR_GH_CLIENT_ID" \
--env="REVEAL_SOCKET_SECRET=0P3N-S0URC3" \
--env="GA_TRACKER=YOUR_GA_TRACKER"
```

Minikube users should be able to open the new service in their browser by running:

    minikube service gist-reveal

### Docker 

To run [the docker image](https://registry.hub.docker.com/u/ryanj/gist-reveal/) locally on port `8080`:

```bash
docker pull ryanj/gist-reveal
docker run -d -p 8080:8080 ryanj/gist-reveal
```

[Environment variables](#Application_Config) can be passed into the Docker container in order to configure the websocket relay, or to change the default slideshow content: 

```bash
docker run -e "REVEAL_SOCKET_SECRET=0P3N-S0URC3" -e "DEFAULT_GIST=YOUR_DEFAULT_GIST_ID" ryanj/gist-reveal
```

### OpenShiftV3

Build from GitHub, using Source2Image:

```bash
oc process -v REVEAL_SOCKET_SECRET=1234 -f https://raw.githubusercontent.com/ryanj/gist-reveal/master/gist-reveal-github.json | oc create -f -
```

Deploy a pre-built image from DockerHub:

```bash
oc process -v REVEAL_SOCKET_SECRET=1234 -f https://raw.githubusercontent.com/ryanj/gist-reveal/master/gist-reveal-dockerhub.json | oc create -f -
```

Or, install one or both of the templates to make these projects easier to launch (from the web, or via `oc new-app templatename`):

```bash
oc create -f https://raw.githubusercontent.com/ryanj/gist-reveal/master/gist-reveal-dockerhub.json
oc create -f https://raw.githubusercontent.com/ryanj/gist-reveal/master/gist-reveal-github.json
oc process gistreveal -v DEFAULT_GIST=${DEFAULT_GIST},GH_CLIENT_ID=${GH_CLIENT_ID},GH_CLIENT_SECRET=${GH_CLIENT_SECRET},REVEAL_SOCKET_SECRET=${REVEAL_SOCKET_SECRET} | oc create -f -
```

If you are building from GitHub, using S2I, you should be able to trigger a build with the following command:

```
oc start-build gistreveal
```

To view the logs for the build, use `osc get builds` to find its name, and supply that name to the command `oc build-logs`. For example: `oc build-logs gistreveal-1`.

### OpenShift.com

This application will also run on any OpenShiftV2 cloud using the `rhc` command-line tool:

```bash
rhc app create gistreveal nodejs-0.10 \
--from-code=http://github.com/ryanj/gist-reveal \ 
DEFAULT_GIST=${DEFAULT_GIST} \ 
GH_CLIENT_SECRET=${GH_CLIENT_SECRET} \ 
GH_CLIENT_ID=${GH_CLIENT_ID} \ 
REVEAL_SOCKET_SECRET=0P3N-S0URC3 \ 
GA_TRACKER=YOUR_GA_TRACKER
```

Or, [click here to launch on the web](https://openshift.redhat.com/app/console/application_types/custom?name=reveal&initial_git_url=https%3A%2F%2Fgithub.com/ryanj/gist-reveal.git&cartridges[]=nodejs-0.10)!

Then, use the `rhc env set` command to publish [configuration strings](#application-config) into the application's system environment.

    
## License

[gist-reveal.it](http://gist-reveal.it/) was created at the first [DockerCon Hackathon](http://blog.docker.com/2014/07/dockercon-video-dockercon-hackathon-winners/) by [@ryanj](https://github.com/ryanj) and [@fkautz](https://github.com/fkautz).

[Reveal.js](https://github.com/hakimel/reveal.js) is MIT licensed
Copyright (C) 2014 Hakim El Hattab, http://hakim.se
