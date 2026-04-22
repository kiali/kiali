package references

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type PeerAuthReferences struct {
	Cluster               string
	Conf                  *config.Config
	IdentityDomain        string
	MTLSDetails           kubernetes.MTLSDetails
	RootNamespaces        map[string]string
	WorkloadsPerNamespace map[string]models.Workloads
}

// NewPeerAuthReferences creates a new PeerAuthReferences with all attributes.
// rootNamespaces maps each namespace to its control plane's root namespace.
func NewPeerAuthReferences(
	cluster string,
	conf *config.Config,
	identityDomain string,
	rootNamespaces map[string]string,
	mtlsDetails kubernetes.MTLSDetails,
	workloadsPerNamespace map[string]models.Workloads,
) PeerAuthReferences {
	return PeerAuthReferences{
		Cluster:               cluster,
		Conf:                  conf,
		IdentityDomain:        identityDomain,
		MTLSDetails:           mtlsDetails,
		RootNamespaces:        rootNamespaces,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}
}

func (n PeerAuthReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, pa := range n.MTLSDetails.PeerAuthentications {
		key := models.IstioReferenceKey{Namespace: pa.Namespace, Name: pa.Name, ObjectGVK: kubernetes.PeerAuthentications}
		references := &models.IstioReferences{}
		references.ObjectReferences = n.getConfigReferences(pa)
		references.WorkloadReferences = n.getWorkloadReferences(pa)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n PeerAuthReferences) getConfigReferences(peerAuthn *security_v1.PeerAuthentication) []models.IstioReference {
	keys := make(map[string]bool)
	allDRs := make([]models.IstioReference, 0)
	result := make([]models.IstioReference, 0)
	if n.RootNamespaces[peerAuthn.Namespace] == peerAuthn.Namespace {
		if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(peerAuthn); mode == "DISABLE" {
			for _, dr := range n.MTLSDetails.DestinationRules {
				if _, mode := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); mode == "DISABLE" {
					allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
				}
			}
		}
	} else {
		// References only for PeerAuthn disabling mTLS
		if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(peerAuthn); mode == "DISABLE" {
			for _, dr := range n.MTLSDetails.DestinationRules {
				if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(peerAuthn.Namespace, dr, n.IdentityDomain); mode == "DISABLE" {
					allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
				}
				if _, mode := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); mode == "DISABLE" {
					allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
				}
			}
		}
	}
	// MeshWide and NamespaceWide references are only needed with autoMtls disabled
	if !n.MTLSDetails.EnabledAutoMtls {
		// PeerAuthentications into  the root namespace namespace are considered Mesh-wide objects
		if n.RootNamespaces[peerAuthn.Namespace] == peerAuthn.Namespace {
			// if MeshPolicy have mtls in strict mode.
			if strictMode := kubernetes.PeerAuthnHasStrictMTLS(peerAuthn); strictMode {
				for _, dr := range n.MTLSDetails.DestinationRules {
					// otherwise, check among Destination Rules for a rule enabling mTLS mesh-wide.
					if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
						allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
					}
				}
			}
		} else {
			if strictMode := kubernetes.PeerAuthnHasStrictMTLS(peerAuthn); strictMode {
				for _, dr := range n.MTLSDetails.DestinationRules {
					// Check if there is a Destination Rule enabling ns-wide mTLS
					if enabled, _ := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(peerAuthn.Namespace, dr, n.IdentityDomain); enabled {
						allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
					}
					// Check if there is a Destination Rule enabling mesh-wide mTLS in second position
					if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
						allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
					}
				}
			}
		}
	}
	// filter unique references
	for _, dr := range allDRs {
		key := util.BuildNameNSKey(dr.Name, dr.Namespace)
		if !keys[key] {
			result = append(result, dr)
			keys[key] = true
		}
	}
	return result
}

func (n PeerAuthReferences) getWorkloadReferences(pa *security_v1.PeerAuthentication) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)

	if pa.Spec.Selector != nil {
		selector := labels.SelectorFromSet(pa.Spec.Selector.MatchLabels)

		// PeerAuth searches Workloads from own namespace
		for _, w := range n.WorkloadsPerNamespace[pa.Namespace] {
			wlLabelSet := labels.Set(w.Labels)
			if selector.Matches(wlLabelSet) {
				result = append(result, models.WorkloadReference{Name: w.Name, Namespace: pa.Namespace})
			}
		}
	}
	return result
}
