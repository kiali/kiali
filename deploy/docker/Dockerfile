# Hawkular OpenShift Agent Dockerfile
FROM centos:centos7

MAINTAINER TODO <TODO-dev@lists.jboss.org>

ENV SWS_HOME=/opt/sws \
    PATH=$SWS_HOME:$PATH

COPY sws $SWS_HOME/

ENTRYPOINT ["/opt/sws/sws"]
