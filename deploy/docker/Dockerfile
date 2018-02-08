FROM centos:centos7

LABEL maintainer="TODO <TODO-dev@lists.jboss.org>"

ENV SWS_HOME=/opt/sws \
    PATH=$SWS_HOME:$PATH

COPY sws $SWS_HOME/

ADD npm/lib/node_modules/swsui/build $SWS_HOME/console/

ENTRYPOINT ["/opt/sws/sws"]
