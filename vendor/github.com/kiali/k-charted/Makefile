SHELL=/bin/bash

godep:
	glide up

gobuild:
	go build

pf4build:
	cd web/pf4 && yarn && yarn build

gotest:
	go test ./...

pf4test:
	cd web/pf4 && yarn test

golint:
	golangci-lint run

pf4lint:
	cd web/pf4 && yarn lint

go: gobuild golint gotest
pf4: pf4build pf4lint pf4test

storybook:
	cd web/pf4 && yarn storybook
