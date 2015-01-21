FROM fedora
MAINTAINER ryanj <ryanj@redhat.com>

RUN yum -y update && yum clean all
RUN yum -y install npm git bzip2 curl build-essential ca-certificates && yum clean all

WORKDIR /app

ADD package.json /app/
RUN npm install
ADD . /app/

EXPOSE 8080

CMD []
ENTRYPOINT ["npm", "start"]
