package tests

import (
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

func TestExternalHostNode(t *testing.T) {
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "injectServiceNodes": "true"}
	name := "foo.bookinfo.ext"

	assert := assert.New(t)
	assertExternalNode(params, "bookinfo-ext-service-entry.yaml", name, assert)
}

func assertExternalNode(params map[string]string, yaml, name string, assert *assert.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/"+yaml)
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		return NodeMatch(params, name)
	})
	assert.Nil(pollErr, "Name %s should exist in node services names", name)
}

func NodeMatch(params map[string]string, nodeName string) (bool, error) {
	graph, statusCode, err := utils.Graph(params)
	if statusCode != 200 {
		return false, err
	}
	for _, node := range graph.Elements.Nodes {
		name := node.Data.Service
		if name == nodeName {
			return true, err
		}
	}
	return false, err
}
