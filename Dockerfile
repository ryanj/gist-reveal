FROM fedora

RUN yum -y update && yum clean all
RUN yum -y install npm git bzip2 && yum clean all

WORKDIR /app

ONBUILD ADD package.json /app/
ONBUILD RUN npm install
ONBUILD ADD . /app

EXPOSE 8080

CMD []
ENTRYPOINT ["npm", "start"]
