//go:build !exclude_frontend

// Kiali
//
// # Kiali Project, The Console for Istio Service Mesh
//
// NOTE! The Kiali API is not for public use and is not supported for any use outside Kiali's own tooling.
// The API can and will change from version to version with no guarantee of backwards compatibility.
//
// To generate this API document, run from the repository root:
//
//	make swagger-doc
//
// The generated doc's Version field uses the Makefile VERSION variable (default in the root Makefile).
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
//	SecurityDefinitions:
//	authorization:
//	  type: basic
//
// swagger:meta
package main

import (
	"github.com/kiali/kiali/cmd"
)

func main() {
	cmd.Execute()
}
