FROM centos:centos7

LABEL maintainer="TODO <TODO-dev@lists.jboss.org>"

ENV SWS_HOME=/opt/sws \
    PATH=$SWS_HOME:$PATH

COPY sws $SWS_HOME/

ADD npm/ $SWS_HOME/npm/

ENTRYPOINT ["/opt/sws/sws"]
