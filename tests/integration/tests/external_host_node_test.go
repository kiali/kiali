package tests

import (
	"context"
	"path"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestExternalHostNode(t *testing.T) {
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "injectServiceNodes": "true"}
	name := "foo.bookinfo.ext"

	require := require.New(t)
	assertExternalNode(params, "bookinfo-ext-service-entry.yaml", name, require)
}

func assertExternalNode(params map[string]string, yaml, name string, require *require.Assertions) {
	params["namespaces"] = kiali.BOOKINFO
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/"+yaml)
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))
	ctx := context.TODO()
	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		return NodeMatch(params, name)
	})
	require.Nil(pollErr, "Name %s should exist in node services names", name)
}

func NodeMatch(params map[string]string, nodeName string) (bool, error) {
	graph, statusCode, err := kiali.Graph(params)
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
