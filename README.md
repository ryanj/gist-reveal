# gist-reveal

[Gist-reveal](http://gist-reveal.it/) is a slideshow templating service that makes it possible to view and share [reveal.js](https://github.com/hakimel/reveal.js) presentations using github's [gist](http://gist.github.com) service as a datastore.

Try it out at: https://gist-reveal.it

## Gist-powered reveal.js presentations

Store revealjs [HTML](https://revealjs.com/markup/) or [Markdown](https://revealjs.com/markdown/) `<section>`s in a [gist](http://gist.github.com), then append your resulting gist id to any `gist-reveal` site url to view your slides:

    https://gist-reveal.it/YOUR_GIST_ID
    
Example:

    https://gist-reveal.it/af84d40e58c5c2a908dd

Use [bit.ly](http://bit.ly) or another url shortener to make these long urls easier to share, and to make enagement rates easier to track.

### Broadcast slide transitions

Presenters can visit [`/login`](https://gist-reveal.it/login) to configure their browser as a presentation device:

    https://gist-reveal.it/login

*WARNING:* Only the gist owner is allowed to broadcast slide transitions to viewers. If needed, fork the slide deck and present using the new gist ID. See the web console output for additional details.

Visit [`/logout`](https://gist-reveal.it/logout) to exit presentation mode:

    https://gist-reveal.it/logout

### Gist-powered themes

Use the "`?theme=`" querystring parameter to access site themes.  Available [CSS themes](https://gist-reveal.it/#/themes) include the default list of [revealjs themes](https://revealjs.com/themes/):

 * [revealjs black theme](http://gist-reveal.it/?theme=black#/themes)
 * [revealjs simple theme](http://gist-reveal.it/?theme=simple#/themes)
 * [revealjs league theme](http://gist-reveal.it/?theme=league#/themes)
 * [revealjs sky theme](http://gist-reveal.it/?theme=sky#/themes)

It is also possible to load a custom theme using [another gist](https://gist-reveal.it/#/gist-themes). For example:

 * [a dark winter theme](http://gist-reveal.it/?theme=60e54843de11a545897e#/gist-themes)

### Nicer presentation paths

Creating a [bit.ly](http://bit.ly) shortname for your longer `gist-reveal/gist_id` deck urls will also make your presentations available at an alternate presentation path:

    http://gist-reveal.it/bit.ly/SHORTNAME

Example:

    http://gist-reveal.it/bit.ly/k8s-workshops

Much nicer!  Make sure to continue sending traffic to the shorter `bit.ly/shortname` url for metrics collection purposes.

## Running gist-reveal
Run your own Gist-powered reveal.js slideshow service with `gist-reveal`

### Application Config

The following environment variables can be used to configure gist-reveal:

Variable Name  | Contents   |  Default Value
---------------|------------|---------------
DEFAULT_GIST   | The default gist id content for the site | [af84d40e58c5c2a908dd](https://gist.github.com/ryanj/af84d40e58c5c2a908dd)
REVEAL_THEME | The site's default theme. Can be a locally bundled theme name, or a remote gist_id | [450836bbaebcf4c4ae08b331343a7886](https://gist.github.com/ryanj/450836bbaebcf4c4ae08b331343a7886) 
GH_API_TOKEN | GitHub API token | unset
CLIENT_ID | GitHub OAuth Client ID. Required for Websocket connections | unset
CLIENT_SECRET | GitHub OAuth Client Secret. Required for Websocket connections | unset
PRIVATE_KEY | TLS private key provided as Env var or file: `private.key` | unset
PUBLIC_CRT | Public TLS certificate as Env var or as file: `public.crt` | unset
PORT | the server port | 8080
GA_TRACKER | Google Analytics tracker token | unset
GIST_THEMES | Allow reveal.js CSS themes to be installed dynamically via querystring "?theme=gist_id" | "true"
SANITIZE_INPUT | Sanitize gist input. Strip script tags and iframes | "false"
GIST_PATH | Load slides from a local gist repo (Disable API and Websockets) | unset
GIST_FILENAME | Load slides from a local gist repo (Disable API and Websockets) |unset

To enable websocket connections, provide an [OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) `CLIENT_ID` and `CLIENT_SECRET` with a redirect url configured to: `YOUR_SITE/github/callback`

### Local Development

Install dependencies:
```bash
npm install
```

Start the app:
```bash
npm start
```

Optionally generate a [localhost certificate](https://letsencrypt.org/docs/certificates-for-localhost/) for testing https+wss connections:
```bash
openssl req -x509 -out public.crt -keyout private.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

#### Local Dev with Local Slides

Prefer to develop slides using your own editor? Or, plan to make a lot of changes to your presentation sources? Try loading a local clone of your gist repo!

1. Make a local clone of your gist repo in another folder:
```bash
git clone git@gist.github.com:af84d40e58c5c2a908dd ../example-slides
```

2. Use the `GIST_PATH` and `GIST_FILENAME` parameters to load local slides:
```bash
GIST_PATH=../example-slides GIST_FILENAME=gist-reveal.it-slides.html npm start
```

When you are done editing, `add` and `commit` your changes then `git push` to deploy.

### Containers

Run the [container image](https://registry.hub.docker.com/r/ryanj/gist-reveal) locally on port `8080` using `podman` or `docker`:

```bash
docker run --rm -p 8080:8080 ryanj/gist-reveal
```

[Environment variables](#application-config) can be passed into the container to configure the default theme, or to change the default slideshow content:

```bash
docker run --rm -p 8080:8080 -e "DEFAULT_GIST=YOUR_DEFAULT_GIST_ID" ryanj/gist-reveal
```

### Kubernetes 
Create a kubernetes `pod` and `service`, both named `gist-reveal`:

```bash
kubectl run gist-reveal --image=ryanj/gist-reveal --expose --port=8080 \
--env="DEFAULT_GIST=YOUR_DEFAULT_GIST_ID" \
--env="GH_API_TOKEN=YOUR_GH_API_TOKEN" \
--env="CLIENT_SECRET=YOUR_GH_CLIENT_SECRET" \
--env="CLIENT_ID=YOUR_CLIENT_ID_VALUE"
```

## License

[gist-reveal](https://gist-reveal.it/) was created at the first [DockerCon Hackathon](https://web.archive.org/web/20140715021725/http://blog.docker.com/2014/07/dockercon-video-dockercon-hackathon-winners/) by [@ryanj](https://github.com/ryanj) and [@fkautz](https://github.com/fkautz).

[Reveal.js](https://github.com/hakimel/reveal.js) is MIT licensed
Copyright (C) 2014 Hakim El Hattab, http://hakim.se
