FROM fedora

RUN yum install -y nodejs
RUN yum install -y npm
RUN yum install -y git
RUN yum install -y bzip2

RUN git clone https://github.com/ryanj/gist-reveal.it.git /app

WORKDIR /app

RUN npm install

EXPOSE 8080

CMD OPENSHIFT_NODEJS_IP=0.0.0.0 npm start
