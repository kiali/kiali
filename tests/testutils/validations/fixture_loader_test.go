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

	rscs := loader.GetResources()
	assert.Equal(len(rscs.PeerAuthentications), 2)

	rsc := rscs.PeerAuthentications[0]
	assert.Equal(rsc.Kind, "PeerAuthentication")
	assert.Equal(rsc.Name, "default")
	assert.Equal(rsc.Namespace, "bookinfo")
	assert.NotEmpty(&rsc.Spec)

	rsc = rscs.PeerAuthentications[1]
	assert.Equal(rsc.Kind, "PeerAuthentication")
	assert.Equal(rsc.Name, "default")
	assert.Equal(rsc.Namespace, "istio-system")
	assert.NotEmpty(&rsc.Spec)

	assert.Equal(len(rscs.VirtualServices), 0)
}
