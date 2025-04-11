package business

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

var numberOfObjectsFlag int

func init() {
	flag.IntVar(&numberOfObjectsFlag, "num-objects", 10, "Number of objects to create of various kinds in the benchmark setup.")
}

func parseFlags(t testing.TB) {
	t.Helper()
	flag.Parse()
}

func TestGetValidationsPerf(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sNumNs := os.Getenv("NUMNS")
	sNumDr := os.Getenv("NUMDR")
	sNumVs := os.Getenv("NUMVS")
	sNumGw := os.Getenv("NUMGW")
	numNs := 10
	numDr := 10
	numVs := 10
	numGw := 10
	if sNumNs != "" {
		if n, err := strconv.Atoi(sNumNs); err == nil {
			numNs = n
		}
		if n, err := strconv.Atoi(sNumDr); err == nil {
			numDr = n
		}
		if n, err := strconv.Atoi(sNumVs); err == nil {
			numVs = n
		}
		if n, err := strconv.Atoi(sNumGw); err == nil {
			numGw = n
		}
	}

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigListPerf(numNs, numDr, numVs, numGw),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	now := time.Now()
	vInfo, err := vs.NewValidationInfo(context.TODO(), []string{conf.KubernetesConfig.ClusterName}, nil)
	require.NoError(err)
	validationPerformed, validations, err := vs.Validate(context.TODO(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	log.Debugf("Validation Performance test took %f seconds for %d namespaces", time.Since(now).Seconds(), numNs)
	assert.True(validationPerformed)
	assert.NotEmpty(validations)
}

func fakeIstioConfigListPerf(numNs, numDr, numVs, numGw int) *models.IstioConfigList {
	istioConfigList := models.IstioConfigList{}

	n := 0
	for n < numNs {
		d := 0
		for d < numDr {
			istioConfigList.DestinationRules = append(istioConfigList.DestinationRules,
				data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule(fmt.Sprintf("test%d", n), fmt.Sprintf("product-dr%d", d), fmt.Sprintf("product%d", d))),
				data.CreateEmptyDestinationRule(fmt.Sprintf("test%d", n), fmt.Sprintf("customer-dr%d", d), fmt.Sprintf("customer%d", d)))
			d++
		}
		v := 0
		for v < numVs {
			istioConfigList.VirtualServices = append(istioConfigList.VirtualServices,
				data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination(fmt.Sprintf("product-%d", v), "v1", -1),
					data.AddTcpRoutesToVirtualService(data.CreateTcpRoute(fmt.Sprintf("product2-%d", v), "v1", -1),
						data.CreateEmptyVirtualService(fmt.Sprintf("product-vs%d", v), fmt.Sprintf("test%d", n), []string{fmt.Sprintf("product%d", v)}))))
			v++
		}
		g := 0
		for g < numGw {
			istioConfigList.Gateways = append(istioConfigList.Gateways, append(getGateway(fmt.Sprintf("first%d", g), fmt.Sprintf("test%d", n)), getGateway(fmt.Sprintf("second%d", g), fmt.Sprintf("test2%d", n))...)...)
			g++
		}
		n++
	}
	return &istioConfigList
}

func BenchmarkValidate(b *testing.B) {
	parseFlags(b)
	services := []string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"}
	conf := config.NewConfig()
	config.Set(conf)
	istioConfigList := fakeIstioConfigListPerf(numberOfObjectsFlag, numberOfObjectsFlag, numberOfObjectsFlag, numberOfObjectsFlag)
	fakeIstioObjects := []runtime.Object{
		&core_v1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		kubetest.FakeNamespace("wrong"),
		kubetest.FakeNamespace("istio-system"),
	}
	for _, p := range fakeMeshPolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeCombinedServices(services, "test") {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeDepSyncedWithRS(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeNamespaces() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeRSSyncedWithPods(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePods().Items {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.Gateways)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.DestinationRules)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.VirtualServices)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.ServiceEntries)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.Sidecars)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.WorkloadEntries)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.RequestAuthentications)...)
	for i := 0; i < numberOfObjectsFlag; i++ {
		fakeIstioObjects = append(fakeIstioObjects, data.CreateAuthorizationPolicyWithPrincipals(fmt.Sprintf("name-%d", i), fmt.Sprintf("ns-%d", i), []string{"principal1", "principal2", "principal2"}))
	}
	for i := 0; i < numberOfObjectsFlag; i++ {
		ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: fmt.Sprintf("ns-%d", i)}}
		fakeIstioObjects = append(fakeIstioObjects, ns)
	}
	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)
	cache := SetupBusinessLayer(b, k8s, *conf)
	cache.SetRegistryStatus(map[string]*kubernetes.RegistryStatus{
		conf.KubernetesConfig.ClusterName: {
			Services: data.CreateFakeMultiRegistryServices(services, "test", "*"),
		},
	})

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{IsKialiHome: true}, Config: models.ControlPlaneConfiguration{}}}},
	}
	namespace := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(k8sclients), k8sclients)
	mesh := NewMeshService(conf, discovery, kubernetes.ConvertFromUserClients(k8sclients))
	layer := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	vs := NewValidationsService(conf, &layer.IstioConfig, cache, &mesh, &namespace, &layer.Svc, k8sclients, &layer.Workload)

	var changeMap ValidationChangeMap
	if conf.ExternalServices.Istio.ValidationChangeDetectionEnabled {
		changeMap = ValidationChangeMap{}
	}

	vInfo, err := vs.NewValidationInfo(context.TODO(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		_, _, err = vs.Validate(context.TODO(), conf.KubernetesConfig.ClusterName, vInfo)
		if err != nil {
			b.Fatal(err)
		}
	}
}
