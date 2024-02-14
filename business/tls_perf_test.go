package business

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
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
	nss, pss, drs := preparePerfScenario(numNs, numDr)

	testPerfScenario(MTLSPartiallyEnabled, nss, drs, pss, false, t)
	testPerfScenario(MTLSEnabled, nss, drs, pss, true, t)
	testPerfScenario(MTLSEnabled, nss, []*networking_v1beta1.DestinationRule{}, pss, true, t)
}

func preparePerfScenario(numNs, numDr int) ([]core_v1.Namespace, []*security_v1beta1.PeerAuthentication, []*networking_v1beta1.DestinationRule) {
	nss := []core_v1.Namespace{}
	pss := []*security_v1beta1.PeerAuthentication{}
	drs := []*networking_v1beta1.DestinationRule{}

	fmt.Printf("TLS perf test. Num NS: %d DR per NS: %d\n", numNs, numDr)
	i := 0
	for i < numNs {
		ns := core_v1.Namespace{}
		ns.Name = fmt.Sprintf("bookinfo-%d", i)
		nss = append(nss, ns)
		ps := *data.CreateEmptyPeerAuthentication(fmt.Sprintf("pa-%d", i), ns.Name, data.CreateMTLS("STRICT"))
		pss = append(pss, &ps)
		j := 0
		for j < numDr {
			dr := *data.CreateEmptyDestinationRule(ns.Name, fmt.Sprintf("dr-%d-%d", i, j), fmt.Sprintf("*.%s.svc.cluster.local", ns.Name))
			drs = append(drs, &dr)
			j++
		}
		i++
	}
	return nss, pss, drs
}

func testPerfScenario(exStatus string, namespaces []core_v1.Namespace, drs []*networking_v1beta1.DestinationRule, ps []*security_v1beta1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	var objs []runtime.Object
	for _, obj := range namespaces {
		o := obj
		objs = append(objs, &o)
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(ps)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(drs)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = &autoMtls

	nss := []string{}
	for _, ns := range namespaces {
		nss = append(nss, ns.Name)
	}
	statuses, err := tlsService.ClusterWideNSmTLSStatus(context.TODO(), nss, conf.KubernetesConfig.ClusterName)
	assert.NoError(err)
	assert.NotEmpty(statuses)
	for _, status := range statuses {
		assert.Equal(exStatus, status.Status)
	}
}
