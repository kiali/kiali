FROM centos:centos7

LABEL maintainer="kiali-dev@googlegroups.com"

ENV KIALI_HOME=/opt/kiali \
    PATH=$KIALI_HOME:$PATH

COPY kiali $KIALI_HOME/

ADD console $KIALI_HOME/console/

ENTRYPOINT ["/opt/kiali/kiali"]
