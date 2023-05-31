package tests

import (
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/stretchr/testify/assert"
)

func TestAppGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "app"
	assertGraphConfig("applications", graphType, kiali.BOOKINFO, name, assert)
}

func TestAppVersionGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "app"
	assertGraphConfig("applications", graphType, kiali.BOOKINFO, name, assert)
}

func TestVersionedAppGraph(t *testing.T) {
	assert := assert.New(t)
	name := "ratings"
	graphType := "versionedApp"
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		config, statusCode, err := kiali.AppVersionGraph(graphType, name, "v1", kiali.BOOKINFO)
		if statusCode != 200 {
			return false, err
		}
		assert.Equal(config.GraphType, graphType)
		assert.NotNil(config.Elements)
		return len(config.Elements.Nodes) > 0 && len(config.Elements.Edges) > 0, nil
	})
	assert.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func TestAppGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "detailswrong"
	graphType := "app"
	assertEmptyGraphConfig("applications", graphType, kiali.BOOKINFO, name, assert)
}

func TestServiceGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "versionedApp"
	assertGraphConfig("services", graphType, kiali.BOOKINFO, name, assert)
}

func TestServiceGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "detailswrong"
	graphType := "workload"
	assertEmptyGraphConfig("services", graphType, kiali.BOOKINFO, name, assert)
}

func TestWorkloadGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	graphType := "workload"
	assertGraphConfig("workloads", graphType, kiali.BOOKINFO, name, assert)
}

func TestWorkloadGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "reviews-wrong"
	graphType := "workload"
	assertEmptyGraphConfig("workloads", graphType, kiali.BOOKINFO, name, assert)
}

func assertGraphConfig(objectType, graphType, namespace, name string, assert *assert.Assertions) {
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		config, statusCode, err := kiali.ObjectGraph(objectType, graphType, name, namespace)
		if statusCode != 200 {
			return false, err
		}
		assert.Equal(config.GraphType, graphType)
		assert.NotNil(config.Elements)
		return len(config.Elements.Nodes) > 0 && len(config.Elements.Edges) > 0, nil
	})
	assert.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func assertEmptyGraphConfig(objectType, graphType, namespace, name string, assert *assert.Assertions) {
	config, statusCode, err := kiali.ObjectGraph(objectType, graphType, name, namespace)
	assert.Equal(200, statusCode)
	assert.Nil(err)
	assert.Equal(config.GraphType, graphType)
	assert.NotNil(config.Elements)
	assert.Empty(config.Elements.Nodes)
	assert.Empty(config.Elements.Edges)
}
