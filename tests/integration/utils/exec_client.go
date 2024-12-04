package utils

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/kiali/kiali/log"
)

var ocCommand = NewExecCommand()

func NewExecCommand() string {
	command := os.Getenv("CLIENT_EXE")
	if command != "" {
		return command
	} else {
		return "oc"
	}
}

// ApplyFileWithCleanup applies a yaml file and deletes it after the test is over.
func ApplyFileWithCleanup(t *testing.T, yamlFilePath, namespace string) bool {
	t.Helper()

	if ApplyFile(yamlFilePath, namespace) {
		t.Cleanup(func() {
			DeleteFile(yamlFilePath, namespace)
		})
		return true
	}
	return false
}

func ApplyFile(yamlFile, namespace string) bool {
	cmd := exec.Command(ocCommand, "apply", "-n="+namespace, "-f="+yamlFile)
	stdout, err := cmd.Output()
	if err != nil {
		var stderr string
		if e, ok := err.(*exec.ExitError); ok {
			stderr = string(e.Stderr)
		}
		log.Errorf("Err: '%s'. stderr: '%s'.", err.Error(), stderr)
		return false
	}
	log.Debugf("%s", stdout)
	return strings.Contains(string(stdout), "created") || strings.Contains(string(stdout), "configure")
}

func DeleteFile(yamlFile, namespace string) bool {
	cmd := exec.Command(ocCommand, "delete", "-n="+namespace, "-f="+yamlFile)
	stdout, err := cmd.Output()
	if err != nil {
		log.Errorf("%s", err.Error())
		return false
	}
	log.Debugf("%s", stdout)
	return strings.Contains(string(stdout), "deleted")
}
