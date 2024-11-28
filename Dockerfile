FROM registry.access.redhat.com/ubi9/nodejs-22:latest

# Copy package.json and package-lock.json
COPY --chown=1001:1001 package*.json ./

# Install app dependencies
RUN npm install --omit=dev

# Copy the dependencies into a minimal Node.js image
FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest

# Install app dependencies
COPY --from=0 /opt/app-root/src/node_modules /opt/app-root/src/node_modules
COPY . /opt/app-root/src

MAINTAINER ryan jarvinen <ryan.jarvinen@gmail.com>
VOLUME ["/opt/app-root/src/css/theme/gists"]
ENV NODE_ENV production
ENV PORT 8080
EXPOSE 8080
CMD ["npm", "start"]
