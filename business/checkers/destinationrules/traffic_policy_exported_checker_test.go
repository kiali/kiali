package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

type NameNamespace struct {
	Name      string
	Namespace string
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify trafficPolicy
// Context: ExportedDestinationRule specifies trafficPolicy
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutTrafficPolicyExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("istio-system", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "istio-system", []string{"default"})
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	presentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify trafficPolicy
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutTrafficPolicyExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("istio-system", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local"),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo2"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "istio-system", []string{"default"})
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	notPresentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify mTLS options
// Context: ExportedDestinationRule doesn't specify mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutmTLSOptionsExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}
	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo2"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	notPresentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify mTLS options
// Context: ExportedDestinationRule specifies mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutmTLSOptionsExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	presentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify port-level mTLS options
// Context: ExportedDestinationRule doesn't specify port-level mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutPortLevelmTLSOptionsExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreatePortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreatePortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo2"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	notPresentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify port-level mTLS options
// Context: ExportedDestinationRule specifies port-level mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutPortLevelmTLSOptionsExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreatePortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy with mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	presentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and mTLS options
// Context: ExportedDestinationRule does specify trafficPolicy and mTLS options
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithTrafficPolicyExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local")),
	}

	testValidationsNotAddedExported(t, destinationRules, edr, mTLSDetails, "reviews", "bookinfo")
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and mTLS options
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithTrafficPolicyExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify TrafficPolicy
		data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo.svc.cluster.local"),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo2"})

	testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and TLS options
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithPortLevelTLSTrafficPolicyExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateTLSPortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "*.bookinfo.svc.cluster.local"),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews2", "bookinfo2"})

	testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and TLS options
// Context: ExportedDestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithPortLevelTLSTrafficPolicyExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateTLSPortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "*.bookinfo.svc.cluster.local")),
	}

	testValidationsNotAddedExported(t, destinationRules, edr, mTLSDetails, "reviews", "bookinfo")
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutTrafficPolicyExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "reviews.bookinfo.svc.cluster.local"),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews2", "bookinfo2"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	notPresentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutTrafficPolicyExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "*.bookinfo.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	presentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify mTLS options
// Context: ExportedDestinationRule refers to own host
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutmTLSOptionsExportedOther(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR refers to itself
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews", "reviews.bookinfo2.svc.cluster.local")),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews", "bookinfo"})

	validation := testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
	presentReferences(t, *validation, "bookinfo", []string{"default"})
	notPresentReferences(t, *validation, "bookinfo2", []string{"reviews"})
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule does specify trafficPolicy
// Context: ExportedDestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestNamespacemTLSEnabledDRWithTrafficPolicyExportedWith(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "reviews.bookinfo.svc.cluster.local")),
	}

	testValidationsNotAddedExported(t, destinationRules, edr, mTLSDetails, "reviews", "bookinfo")
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule does specify trafficPolicy
// Context: ExportedDestinationRule doesn't specify trafficPolicy
// It doesn't return any validation
func TestNamespacemTLSEnabledDRWithTrafficPolicyExportedWithout(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "*.bookinfo.svc.cluster.local"),
	}

	nameNamespaces := []NameNamespace{}
	nameNamespaces = append(nameNamespaces, NameNamespace{"reviews2", "bookinfo2"})

	testValidationAddedExported(t, destinationRules, edr, mTLSDetails, nameNamespaces)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy and host is from other namespace
// Context: ExportedDestinationRule doesn't specify trafficPolicy and host is from other namespace
// It doesn't return any validation
func TestCrossNamespaceProtectionExported(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other", "reviews", "reviews.other.svc.cluster.local")),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other2", "reviews", "reviews.other2.svc.cluster.local")),
	}

	testValidationsNotAddedExported(t, destinationRules, edr, mTLSDetails, "reviews", "other")
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy and host is from a ServiceEntry
// It doesn't return any validation
func TestCrossNamespaceServiceEntryProtectionExported(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other", "service-entry-dr", "wikipedia.org")),
	}

	edr := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other2", "service-entry-dr2", "wikipedia.org")),
	}

	testValidationsNotAddedExported(t, destinationRules, edr, mTLSDetails, "service-entry-dr", "other")
}

func testValidationAddedExported(t *testing.T, destinationRules []*networking_v1.DestinationRule, exportedDestinationRules []*networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails, nameNamespaces []NameNamespace) *models.IstioValidation {
	assert := assert.New(t)

	vals := TrafficPolicyChecker{
		Cluster:          config.DefaultClusterID,
		DestinationRules: append(destinationRules, exportedDestinationRules...),
		MTLSDetails:      mTLSDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(len(nameNamespaces), len(vals))

	result := models.IstioValidation{}
	for _, nameNamespace := range nameNamespaces {
		validation, ok := vals[models.BuildKey(DestinationRulesCheckerType, nameNamespace.Name, nameNamespace.Namespace, config.DefaultClusterID)]
		assert.True(ok)
		assert.True(validation.Valid)

		assert.NotEmpty(validation.Checks)
		assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
		assert.Equal("spec/trafficPolicy", validation.Checks[0].Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.trafficpolicy.notlssettings", validation.Checks[0]))
		assert.True(len(validation.References) > 0)

		result = *validation
	}

	return &result
}

func testValidationsNotAddedExported(t *testing.T, destinationRules []*networking_v1.DestinationRule, exportedDestinationRules []*networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails, name string, namespace string) {
	assert := assert.New(t)

	vals := TrafficPolicyChecker{
		Cluster:          config.DefaultClusterID,
		DestinationRules: append(destinationRules, exportedDestinationRules...),
		MTLSDetails:      mTLSDetails,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.BuildKey(DestinationRulesCheckerType, name, namespace, config.DefaultClusterID)]

	assert.False(ok)
	assert.Nil(validation)
}

func notPresentReferences(t *testing.T, validation models.IstioValidation, ns string, serviceNames []string) {
	assert := assert.New(t)

	for _, sn := range serviceNames {
		refKey := models.IstioValidationKey{ObjectType: "destinationrule", Namespace: ns, Name: sn, Cluster: config.DefaultClusterID}
		assert.NotContains(validation.References, refKey)
	}
}
