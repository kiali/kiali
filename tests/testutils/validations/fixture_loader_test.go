package validations

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetResources(t *testing.T) {
	assert := assert.New(t)

	loader := YamlFixtureLoader{Filename: "../../data/loader/basic.yaml"}
	err := loader.Load()

	assert.NoError(err)
	assert.NotEmpty(loader)

	rscs := loader.GetResources("PeerAuthentication")
	assert.Len(rscs, 2)

	rsc := rscs[0]
	assert.Equal(rsc.GetObjectKind().GroupVersionKind().Kind, "PeerAuthentication")
	assert.Equal(rsc.GetObjectMeta().Name, "default")
	assert.Equal(rsc.GetObjectMeta().Namespace, "bookinfo")
	assert.NotEmpty(rsc.GetSpec())

	rsc = rscs[1]
	assert.Equal(rsc.GetObjectKind().GroupVersionKind().Kind, "PeerAuthentication")
	assert.Equal(rsc.GetObjectMeta().Name, "default")
	assert.Equal(rsc.GetObjectMeta().Namespace, "istio-system")
	assert.NotEmpty(rsc.GetSpec())

	rscs = loader.GetResources("VirtualService")
	assert.Len(rscs, 0)
}
