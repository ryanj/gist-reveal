FROM registry.access.redhat.com/ubi8/nodejs-14:latest
VOLUME ["/opt/app-root/src/css/theme/gists"]
MAINTAINER ryan jarvinen <ryan.jarvinen@gmail.com>

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the dependencies into a minimal Node.js image
FROM registry.access.redhat.com/ubi8/nodejs-14-minimal:latest

# Install app dependencies
COPY --from=0 /opt/app-root/src/node_modules /opt/app-root/src/node_modules
COPY . /opt/app-root/src

ENV NODE_ENV production
ENV PORT 8080
EXPOSE 8080
CMD ["npm", "start"]
