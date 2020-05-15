package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestGatewayAsHost(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("bookinfo/mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.istio-system.svc.cluster.local", ParseGatewayAsHost("istio-system/mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo.svc.cluster.local", "bookinfo", "svc.cluster.local").String())
}
