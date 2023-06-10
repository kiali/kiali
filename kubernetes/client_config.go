/*
Copyright 2014 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package kubernetes

import (
	"fmt"
	"strings"
	"unicode"

	"k8s.io/client-go/tools/clientcmd/api"
)

// cleanANSIEscapeCodes takes an arbitrary string and ensures that there are no
// ANSI escape sequences that could put the terminal in a weird state (e.g.,
// "\e[1m" bolds text)
// From the "kubernetes/client-go" repository.
// (https://github.com/kubernetes/client-go/blob/b8a8d9494492f5a03b3f1449bee19eb22fda4bd5/tools/clientcmd/client_config.go#L331)
func cleanANSIEscapeCodes(s string) string {
	// spaceControlCharacters includes tab, new line, vertical tab, new page, and
	// carriage return. These are in the unicode.Cc category, but that category also
	// contains ESC (U+001B) which we don't want.
	spaceControlCharacters := unicode.RangeTable{
		R16: []unicode.Range16{
			{Lo: 0x0009, Hi: 0x000D, Stride: 1},
		},
	}

	// Why not make this deny-only (instead of allow-only)? Because unicode.C
	// contains newline and tab characters that we want.
	allowedRanges := []*unicode.RangeTable{
		unicode.L,
		unicode.M,
		unicode.N,
		unicode.P,
		unicode.S,
		unicode.Z,
		&spaceControlCharacters,
	}
	builder := strings.Builder{}
	for _, roon := range s {
		if unicode.IsOneOf(allowedRanges, roon) {
			builder.WriteRune(roon) // returns nil error, per go doc
		} else {
			fmt.Fprintf(&builder, "%U", roon)
		}
	}
	return builder.String()
}

// From the "kubernetes/client-go" repository.
// (https://github.com/kubernetes/client-go/blob/b8a8d9494492f5a03b3f1449bee19eb22fda4bd5/tools/clientcmd/api/v1/defaults.go#L27-L37)
func SetDefaultsExecConfig(exec *api.ExecConfig) {
	if len(exec.InteractiveMode) == 0 {
		switch exec.APIVersion {
		case "client.authentication.k8s.io/v1beta1", "client.authentication.k8s.io/v1alpha1":
			// default to IfAvailableExecInteractiveMode for backwards compatibility
			exec.InteractiveMode = api.IfAvailableExecInteractiveMode
		default:
			// require other versions to explicitly declare whether they want stdin or not
		}
	}
}
