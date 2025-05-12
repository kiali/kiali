package tracing

import (
	"context"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	"testing"
)

func fakeK8sNs() kubernetes.UserClientInterface {
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = false
	return k8s
}

func TestCreateClient(t *testing.T) {

	k8s := fakeK8sNs()
	conf := config.Get()
	tc, err := TestNewClient(context.TODO(), conf, k8s.GetToken())

	assert.Nil(t, err)
	assert.NotNil(t, tc)
}
