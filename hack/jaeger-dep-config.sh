#!/usr/bin/env bash

# This hack script helps to clone the minimal dependencies from jaeger and to build the proto classes.
# This hack script is a one time script to build the jaeger dependencies, unless a change in the Jaeger api_v2 there is
# no need to update this.

# Build the Jaeger proto model
# Note that model.proto and query.proto are simplified, removing the "gogo" dependencies to not introduce problems
# with other grpc dependencies like the istio.io/client-go

# Using protoc directly:
# protoc model.proto -I. --go_out=model
# protoc query.proto -I. -I${GOPATH}/src/github.com/googleapis/googleapis/ --go_out=plugins=grpc:model

# Using all protoc binaries and dependencies from a docker image:
docker run --rm -u $(id -u) -v${KIALI_SRC}:${KIALI_SRC} -w${KIALI_SRC} jaegertracing/protobuf:latest \
  --proto_path=${KIALI_SRC}/jaeger --go_out=${KIALI_SRC}/jaeger/model ${KIALI_SRC}/jaeger/model.proto
docker run --rm -u $(id -u) -v${KIALI_SRC}:${KIALI_SRC} -w${KIALI_SRC} jaegertracing/protobuf:latest \
  --proto_path=${KIALI_SRC}/jaeger --go_out=plugins=grpc:${KIALI_SRC}/jaeger/model ${KIALI_SRC}/jaeger/query.proto