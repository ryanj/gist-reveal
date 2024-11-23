# Gist-Reveal

## Gist-powered Revealjs presentations

[Gist-Reveal.it](http://gist-reveal.it/) is an open source slideshow templating service that makes it possible to create, edit, present, and share [Reveal.js](https://github.com/hakimel/reveal.js) slides using github's [gist](http://gist.github.com) service as a datastore.

#### gist-reveal.it/YOUR_GIST_ID

Store any Revealjs-compatible [HTML](https://revealjs.com/markup/) or [Markdown](https://revealjs.com/markdown/) content in a [gist](http://gist.github.com), then [append your resulting gist id to the end of any gist-reveal site url](http://gist-reveal.it/af84d40e58c5c2a908dd#/try-it) to view the resulting presentation:

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

### Broadcasting Slide Transitions

Administrators can configure the application's `CLIENT_ID` and `CLIENT_SECRET` to enable broadcasting of slide transitions using SocketIO.

Presenters can visit [`/login`](https://gist-reveal.it/login) to configure their browser as a presentation device:

    https://gist-reveal.it/login

WARNING: You can only broadcast slide transitions for presentations where you are the gist owner.  Mismatched presenter actions are ignored.  If needed, fork the slide deck and present using your new gist_id!

When you are finished presenting, reset to "Listener" mode by visiting [`/logout`](https://gist-reveal.it/logout):

    https://gist-reveal.it/logout

## Gist-powered Slideshow Themes

Available [CSS themes](https://gist-reveal.it/#/themes) include the default list of [Revealjs themes](https://revealjs.com/themes/), but can be extended by storing a new theme [in a gist](https://gist-reveal.it/#/gist-themes):

 * [the revealjs black theme](http://gist-reveal.it/?theme=black#/themes)
 * [the revealjs simple theme](http://gist-reveal.it/?theme=simple#/themes)
 * [the revealjs league theme](http://gist-reveal.it/?theme=league#/themes)
 * [the revealjs sky theme](http://gist-reveal.it/?theme=sky#/themes)
 * [a dark winter theme](http://gist-reveal.it/?theme=60e54843de11a545897e#/gist-themes)

Conference organizers can host their own modified gist-reveal templating service (with its own default theme), to provide a consistent look for all presentations at an event.

## Running Gist-Reveal.it
Run your own Gist-powered RevealJS slideshow service with gist-reveal

### Application Config

The following environment variables can be used to autoconfigure the application:

Variable Name  | Contents   |  Default Value
---------------|------------|---------------
PORT | The server port number | 8080
DEFAULT_GIST   | The default gist id content for the site | [af84d40e58c5c2a908dd](https://gist.github.com/ryanj/af84d40e58c5c2a908dd)
REVEAL_THEME | The site's default theme. Can be a locally bundled theme name, or a remote gist_id | [450836bbaebcf4c4ae08b331343a7886](https://gist.github.com/ryanj/450836bbaebcf4c4ae08b331343a7886) 
GH_API_TOKEN | GitHub API token | unset
CLIENT_ID | GitHub OAuth App Client ID | unset
CLIENT_SECRET | GitHub OAuth App Client Secret | unset
PRIVATE_KEY | TLS private key provided as Env var or file: `private.key` | unset
PUBLIC_CRT | Public TLS certificate as Env var or as file: `public.crt` | unset
GA_TRACKER | Google Analytics tracker token | unset
GIST_THEMES | Allow reveal.js CSS themes to be installed dynamically "url/?theme=gist_id". Disable this feature by setting this config to the string "false". | true
SANITIZE | Sanitize gist input. Strip script tags and iframes | false

See [`index.js`](https://github.com/ryanj/gist-reveal/blob/master/index.js#L80-L96) for more information about the site's configuration options.

### Local Development

The simplest way to get started with this project, is to clone a copy of the source from github (`git clone http://github.com/ryanj/gist-reveal && cd gist-reveal`), then run the app locally with `npm install` followed by `npm start`.

Optionally generate a [localhost certificate](https://letsencrypt.org/docs/certificates-for-localhost/) for testing https/wss connections:
```bash
openssl req -x509 -out public.crt -keyout private.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

### Podman or Docker

Run the [container image](https://registry.hub.docker.com/r/ryanj/gist-reveal) locally on port `8080`:

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

[gist-reveal.it](http://gist-reveal.it/) was created at the first [DockerCon Hackathon](http://blog.docker.com/2014/07/dockercon-video-dockercon-hackathon-winners/) by [@ryanj](https://github.com/ryanj) and [@fkautz](https://github.com/fkautz).

[Reveal.js](https://github.com/hakimel/reveal.js) is MIT licensed
Copyright (C) 2014 Hakim El Hattab, http://hakim.se
