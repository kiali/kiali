SHELL=/bin/bash

godep:
	glide up

gobuild:
	go build

pf3build:
	cd web/pf3 && yarn && yarn build

pf4build:
	cd web/pf4 && yarn && yarn build

gotest:
	go test ./...

pf3test:
	cd web/pf3 && yarn test

pf4test:
	cd web/pf4 && yarn test

golint:
	golangci-lint run

pf3lint:
	cd web/pf3 && yarn lint

pf4lint:
	cd web/pf4 && yarn lint

go: gobuild golint gotest
pf3: pf3build pf3lint pf3test
pf4: pf4build pf4lint pf4test
