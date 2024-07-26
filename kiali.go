//go:build !exclude_frontend

// Kiali
//
// # Kiali Project, The Console for Istio Service Mesh
//
// NOTE! The Kiali API is not for public use and is not supported for any use outside of the Kiali UI itself.
// The API can and will change from version to version with no guarantee of backwards compatibility.
//
// To generate this API document:
// ```
//
//	> alias swagger='docker run --rm -it  --user $(id -u):$(id -g) -e GOCACHE=/tmp -e GOPATH=$(go env GOPATH):/go -v $HOME:$HOME -w $(pwd) quay.io/goswagger/swagger'
//	> swagger generate spec -o ./swagger.json
//	> swagger generate markdown --quiet --spec ./swagger.json --output ./kiali_internal_api.md
//
// ```
//
//	Schemes: http, https
//	BasePath: /api
//	Version: _
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
// swagger:meta
package main

import (
	"github.com/kiali/kiali/cmd"
)

func main() {
	cmd.Execute()
}
