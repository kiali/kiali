package tests

import (
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

func TestExternalHostNode(t *testing.T) {
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "injectServiceNodes": "true"}
	name := "foo.bookinfo.ext"

	require := require.New(t)
	requireExternalNode(params, "bookinfo-ext-service-entry.yaml", name, require)
}

func requireExternalNode(params map[string]string, yaml, name string, require *require.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/"+yaml)
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	require.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		return NodeMatch(params, name)
	})
	require.Nil(pollErr, "Name %s should exist in node services names", name)
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
