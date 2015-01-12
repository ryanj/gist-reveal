FROM fedora

RUN yum install -y nodejs
RUN yum install -y npm
RUN yum install -y git
RUN yum install -y bzip2

COPY . /app

WORKDIR /app

RUN cd /app; npm install

EXPOSE 8080

CMD OPENSHIFT_NODEJS_IP=0.0.0.0 npm start
