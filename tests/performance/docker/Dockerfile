FROM golang
LABEL maintainer="Kiali <kiali-dev@googlegroups.com>"
RUN go get -u github.com/tsenart/vegeta
RUN go get -u github.com/influxdata/influxdb1-client/v2
RUN go get -u github.com/satori/go.uuid
USER root
ADD performance.go .
CMD go run performance.go