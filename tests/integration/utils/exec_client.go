package utils

import (
	"os/exec"
	"strings"

	"github.com/kiali/kiali/log"
)

func ApplyFile(yamlFile, namespace string) bool {
	cmd := exec.Command("oc", "apply", "-n="+namespace, "-f="+yamlFile)
	stdout, err := cmd.Output()

	if err != nil {
		log.Errorf(err.Error())
		return false
	}
	log.Debugf(string(stdout))
	return strings.Contains(string(stdout), "created") || strings.Contains(string(stdout), "configure")
}

func DeleteFile(yamlFile, namespace string) bool {
	cmd := exec.Command("oc", "delete", "-n="+namespace, "-f="+yamlFile)
	stdout, err := cmd.Output()

	if err != nil {
		log.Errorf(err.Error())
		return false
	}
	log.Debugf(string(stdout))
	return strings.Contains(string(stdout), "deleted")
}
