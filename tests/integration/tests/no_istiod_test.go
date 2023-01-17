package tests

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"os/exec"
	"testing"
)

func TestInit(t *testing.T) {
	assert := assert.New(t)

	//var ocCommand = utils.NewExecCommand()
	ocCommand := "kubectl"
	cmd := exec.Command(ocCommand, "get", "cm", "kiali", "-n=istio-system", "-o yaml | sed -e 's|istio_api_enabled: true|istio_api_enabled: false|' | kubectl apply -f -")
	_, err := cmd.Output()

	if err != nil {
		cmd2 := exec.Command(ocCommand, "get", "pods -o name -n istio-system | egrep kiali | sed 's|pod/||'")
		stdout, err2 := cmd2.Output()
		if err2 != nil {
			fmt.Printf("Str %s", stdout)
		}
	}

	assert.Nil(err)
}
