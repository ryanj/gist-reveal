FROM fedora

RUN yum -y update && yum clean all
RUN yum -y install npm git bzip2 && yum clean all

ADD . /app

WORKDIR /app

RUN cd /app; npm install

EXPOSE 8080

CMD npm start
