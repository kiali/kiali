package business

import (
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/mock"
)

func TestTlsPerfNsDr(t *testing.T) {
	sNumNs := os.Getenv("NUMNS")
	sNumDr := os.Getenv("NUMDR")
	numNs := 10
	numDr := 10
	if sNumNs != "" {
		if n, err := strconv.Atoi(sNumNs); err == nil {
			numNs = n
		}
		if n, err := strconv.Atoi(sNumDr); err == nil {
			numDr = n
		}
	}
	// Iterate on namespaces
	preparePerfScenario(t, numNs, numDr)
}

func preparePerfScenario(t *testing.T, numNs, numDr int) {
	nss := []core_v1.Namespace{}
	pss := []security_v1beta1.PeerAuthentication{}
	drs := []networking_v1alpha3.DestinationRule{}

	fmt.Printf("TLS perf test. Num NS: %d DR per NS: %d\n", numNs, numDr)
	i := 0
	for i < numNs {
		ns := core_v1.Namespace{}
		ns.Name = fmt.Sprintf("bookinfo-%d", i)
		nss = append(nss, ns)
		ps := *data.CreateEmptyPeerAuthentication(fmt.Sprintf("pa-%d", i), ns.Name, data.CreateMTLS("STRICT"))
		pss = append(pss, ps)
		j := 0
		for j < numDr {
			dr := *data.CreateEmptyDestinationRule(ns.Name, fmt.Sprintf("dr-%d-%d", i, j), fmt.Sprintf("*.%s.svc.cluster.local", ns.Name))
			drs = append(drs, dr)
			j++
		}
		i++
	}
	testPerfScenario(MTLSPartiallyEnabled, nss, drs, pss, false, t)
	testPerfScenario(MTLSEnabled, nss, drs, pss, true, t)
	testPerfScenario(MTLSEnabled, nss, []networking_v1alpha3.DestinationRule{}, pss, true, t)
}

func testPerfScenario(exStatus string, nss []core_v1.Namespace, drs []networking_v1alpha3.DestinationRule, ps []security_v1beta1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	k8s := new(kubetest.K8SClientMock)
	fakeIstioObjects := []runtime.Object{}
	for _, d := range drs {
		fakeIstioObjects = append(fakeIstioObjects, d.DeepCopyObject())
	}
	for _, p := range ps {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	k8s.MockIstio(fakeIstioObjects...)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetNamespaces", mock.AnythingOfType("string")).Return(nss, nil)
	for _, ns := range nss {
		k8s.On("GetNamespace", ns.Name).Return(&ns, nil)
	}
	config.Set(config.NewConfig())

	tlsService := TLSService{k8s: k8s, enabledAutoMtls: &autoMtls, businessLayer: NewWithBackends(k8s, nil, nil)}
	tlsService.businessLayer.Namespace.isAccessibleNamespaces["**"] = true
	for _, ns := range nss {
		status, err := (tlsService).NamespaceWidemTLSStatus(ns.Name)
		assert.NoError(err)
		assert.Equal(exStatus, status.Status)
	}
}
