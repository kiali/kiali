FROM registry.access.redhat.com/ubi8-minimal

LABEL maintainer="kiali-dev@googlegroups.com"

ENV KIALI_HOME=/opt/kiali \
    PATH=$KIALI_HOME:$PATH

WORKDIR $KIALI_HOME

COPY kiali $KIALI_HOME/

ADD console $KIALI_HOME/console/

RUN chgrp -R 0 $KIALI_HOME/console && \
    chmod -R g=u $KIALI_HOME/console

ENTRYPOINT ["/opt/kiali/kiali"]
