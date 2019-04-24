SHELL=/bin/bash

dep: godep reactdep

godep:
	glide up

reactdep:
	cd web/react && yarn

build: gobuild reactbuild

gobuild:
	go build

reactbuild:
	cd web/react && yarn build

test: gotest reacttest

gotest:
	go test ./...

reacttest:
	cd web/react && yarn test

lint: golint reactlint

golint:
	golangci-lint run

reactlint:
	cd web/react && yarn lint

go: gobuild golint gotest
react: reactbuild reactlint reacttest
