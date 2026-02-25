package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func prepareTestForServiceEntry(ap *security_v1.AuthorizationPolicy, dr *networking_v1.DestinationRule, se *networking_v1.ServiceEntry, sc *networking_v1.Sidecar) models.IstioReferences {
	drReferences := ServiceEntryReferences{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Conf:                  config.Get(),
		DestinationRules:      []*networking_v1.DestinationRule{dr},
		Namespace:             "bookinfo",
		Namespaces:            []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:        []*networking_v1.ServiceEntry{se},
		Sidecars:              []*networking_v1.Sidecar{sc},
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: se.Namespace, Name: se.Name}]
}

func TestServiceEntryReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), getAPServiceEntry(t), getSidecar(t))

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check Service references (built from se.Spec.Hosts)
	assert.Len(references.ServiceReferences, 2)
	assert.Contains([]string{references.ServiceReferences[0].Name, references.ServiceReferences[1].Name}, "foo-dev.istio-system.svc.cluster.local")
	assert.Contains([]string{references.ServiceReferences[0].Name, references.ServiceReferences[1].Name}, "foo-dev.bookinfo.svc.cluster.local")

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 3)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())

	assert.Equal(references.ObjectReferences[1].Name, "foo-sidecar")
	assert.Equal(references.ObjectReferences[1].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[1].ObjectGVK.String(), kubernetes.Sidecars.String())

	assert.Equal(references.ObjectReferences[2].Name, "allow-foo")
	assert.Equal(references.ObjectReferences[2].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[2].ObjectGVK.String(), kubernetes.AuthorizationPolicies.String())
}

func TestServiceEntryNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks - fakeServiceEntry has hosts ["*.googleapis.com"], so we get 1 ServiceReference from hosts
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), fakeServiceEntry(), getSidecar(t))
	assert.Len(references.ServiceReferences, 1)
	assert.Equal("*.googleapis.com", references.ServiceReferences[0].Name)
	assert.Equal("test", references.ServiceReferences[0].Namespace)
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ObjectReferences)
}

func TestServiceEntryReferencesExportToNone(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{}
	se.Name = "external-api"
	se.Namespace = "team-a"
	se.Spec.Hosts = []string{"api.example.com"}
	se.Spec.ExportTo = []string{"~"}

	refs := ServiceEntryReferences{
		Conf:           conf,
		Namespace:      "team-a",
		Namespaces:     []string{"team-a"},
		ServiceEntries: []*networking_v1.ServiceEntry{se},
	}
	result := refs.References()
	seRefs := result[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "team-a", Name: "external-api"}]
	assert.Empty(seRefs.ServiceReferences)
}

func TestServiceEntryReferencesExportToOtherNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{}
	se.Name = "shared-api"
	se.Namespace = "infra"
	se.Spec.Hosts = []string{"api.internal.com"}
	se.Spec.ExportTo = []string{"consumer-ns"}

	refs := ServiceEntryReferences{
		Conf:           conf,
		Namespace:      "infra",
		Namespaces:     []string{"infra", "consumer-ns"},
		ServiceEntries: []*networking_v1.ServiceEntry{se},
	}
	result := refs.References()
	seRefs := result[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "infra", Name: "shared-api"}]
	assert.Empty(seRefs.ServiceReferences)
}

func TestServiceEntryReferencesKubeServiceNotVisible(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	svc := fakeService("reviews", "bookinfo")
	svc.Annotations = map[string]string{
		kubernetes.ExportToAnnotation: "bookinfo",
	}
	kubeHosts := kubernetes.KubeServiceFQDNs([]core_v1.Service{svc}, conf)

	se := &networking_v1.ServiceEntry{}
	se.Name = "override-reviews"
	se.Namespace = "other-ns"
	se.Spec.Hosts = []string{"reviews.bookinfo.svc.cluster.local"}

	refs := ServiceEntryReferences{
		Conf:             conf,
		KubeServiceHosts: kubeHosts,
		Namespace:        "other-ns",
		Namespaces:       []string{"other-ns", "bookinfo"},
		ServiceEntries:   []*networking_v1.ServiceEntry{se},
	}
	result := refs.References()
	seRefs := result[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "other-ns", Name: "override-reviews"}]
	assert.Empty(seRefs.ServiceReferences)
}

func TestServiceEntryReferencesKubeServiceVisible(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	svc := fakeService("reviews", "bookinfo")
	kubeHosts := kubernetes.KubeServiceFQDNs([]core_v1.Service{svc}, conf)

	se := &networking_v1.ServiceEntry{}
	se.Name = "override-reviews"
	se.Namespace = "bookinfo"
	se.Spec.Hosts = []string{"reviews.bookinfo.svc.cluster.local"}

	refs := ServiceEntryReferences{
		Conf:             conf,
		KubeServiceHosts: kubeHosts,
		Namespace:        "bookinfo",
		Namespaces:       []string{"bookinfo"},
		ServiceEntries:   []*networking_v1.ServiceEntry{se},
	}
	result := refs.References()
	seRefs := result[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "bookinfo", Name: "override-reviews"}]
	assert.Len(seRefs.ServiceReferences, 1)
	assert.Equal("reviews.bookinfo.svc.cluster.local", seRefs.ServiceReferences[0].Name)
}

func TestServiceEntryReferencesMixed(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	svc := fakeService("reviews", "bookinfo")
	svc.Annotations = map[string]string{
		kubernetes.ExportToAnnotation: "bookinfo",
	}
	kubeHosts := kubernetes.KubeServiceFQDNs([]core_v1.Service{svc}, conf)

	se := &networking_v1.ServiceEntry{}
	se.Name = "mixed-se"
	se.Namespace = "other-ns"
	se.Spec.Hosts = []string{
		"reviews.bookinfo.svc.cluster.local",
		"api.example.com",
	}
	se.Spec.ExportTo = []string{"*"}

	refs := ServiceEntryReferences{
		Conf:             conf,
		KubeServiceHosts: kubeHosts,
		Namespace:        "other-ns",
		Namespaces:       []string{"other-ns", "bookinfo"},
		ServiceEntries:   []*networking_v1.ServiceEntry{se},
	}
	result := refs.References()
	seRefs := result[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "other-ns", Name: "mixed-se"}]
	assert.Len(seRefs.ServiceReferences, 1)
	assert.Equal("api.example.com", seRefs.ServiceReferences[0].Name)
}

func fakeService(name, namespace string) core_v1.Service {
	return core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
	}
}

func getAPDestinationRule(t *testing.T) *networking_v1.DestinationRule {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRule("foo-dev", "istio-system")
}
