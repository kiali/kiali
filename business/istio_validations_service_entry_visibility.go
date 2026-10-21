package business

import (
	"crypto/sha256"
	"fmt"
	"maps"
	"slices"

	"google.golang.org/protobuf/proto"
	meshapi "istio.io/api/mesh/v1alpha1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// serviceEntryVisibilityCache belongs to one cluster's validation pass. Policies
// come from the requesting control plane; selectors match definition-namespace labels.
// Resolved policies are reused across namespaces sharing the same mesh snapshot.
type serviceEntryVisibilityCache struct {
	meshConfigs map[string]*models.MeshConfig
	namespaces  map[string]models.Namespace
	policies    map[*models.MeshConfig]*models.ServiceEntryVisibilityPolicy
	resolved    map[*models.ServiceEntryVisibilityPolicy]map[string]models.ServiceEntryVisibility
}

func (v *validationInfo) serviceEntryVisibility() *serviceEntryVisibilityCache {
	if v.clusterInfo.serviceEntryVisibility != nil {
		return v.clusterInfo.serviceEntryVisibility
	}
	cluster := v.clusterInfo.cluster
	namespaces := make(map[string]models.Namespace, len(v.nsMap[cluster]))
	for _, ns := range v.nsMap[cluster] {
		namespaces[ns.Name] = ns
	}

	meshConfigs := v.clusterInfo.namespaceMeshConfigs
	if meshConfigs == nil {
		// Direct checker tests may not have run the normal control-plane setup.
		meshConfigs = v.mesh.BuildNamespaceToMeshConfig(cluster, slices.Collect(maps.Keys(namespaces)))
	}
	result := &serviceEntryVisibilityCache{
		meshConfigs: meshConfigs, namespaces: namespaces,
		policies: make(map[*models.MeshConfig]*models.ServiceEntryVisibilityPolicy),
		resolved: make(map[*models.ServiceEntryVisibilityPolicy]map[string]models.ServiceEntryVisibility),
	}
	v.clusterInfo.serviceEntryVisibility = result
	return result
}

func (c *serviceEntryVisibilityCache) isVisible(entry *networkingv1.ServiceEntry, requester string) bool {
	meshConfig := c.meshConfigs[requester]
	policy := c.policies[meshConfig]
	if policy == nil {
		// A nil MeshConfig uses defaults for unmanaged requesters.
		policy = meshConfig.ServiceEntryVisibilityPolicy()
		c.policies[meshConfig] = policy
	}
	ambient := c.namespaces[requester].IsAmbient
	exportTo := entry.Spec.ExportTo
	if !ambient {
		if len(exportTo) == 0 && meshConfig != nil && meshConfig.MeshConfig != nil {
			exportTo = meshConfig.DefaultServiceExportTo
		}
		// Unlike graph/telemetry/istio/appender/service_entry.go, validation widens
		// unknown export namespaces to avoid cascading missing-host errors. Both paths
		// honor mesh defaults, and the visibility policy still caps this scope.
		for _, ns := range exportTo {
			if ns != "." && ns != "*" && ns != "~" {
				if _, found := c.namespaces[ns]; !found {
					exportTo = []string{"*"}
					break
				}
			}
		}
		if meshConfig == nil || !meshConfig.GetServiceEntryVisibility().GetApplyToSidecars() {
			return policy.IsExportedTo(exportTo, entry.Namespace, requester)
		}
	}
	resolved := c.resolved[policy]
	if resolved == nil {
		resolved = make(map[string]models.ServiceEntryVisibility)
		c.resolved[policy] = resolved
	}
	visibility, found := resolved[entry.Namespace]
	if !found {
		visibility = policy.ForNamespace(entry.Namespace, c.namespaces[entry.Namespace].Labels)
		resolved[entry.Namespace] = visibility
	}
	return visibility.IsVisible(exportTo, requester, ambient)
}

// version makes refreshed visibility settings participate in validation change
// detection. Hash each distinct mesh snapshot once; namespace bindings are sorted
// so discovery ordering does not cause needless validation runs.
// Definition-namespace label changes are tracked separately by NewValidationInfo.
func (c *serviceEntryVisibilityCache) version() string {
	digest := sha256.New()
	versions := make(map[*models.MeshConfig][sha256.Size]byte)
	for _, ns := range slices.Sorted(maps.Keys(c.meshConfigs)) {
		meshConfig := c.meshConfigs[ns]
		version, found := versions[meshConfig]
		if !found {
			var visibilityConfig meshapi.MeshConfig
			if meshConfig != nil && meshConfig.MeshConfig != nil {
				visibilityConfig.DefaultServiceExportTo = meshConfig.DefaultServiceExportTo
				visibilityConfig.ServiceEntryVisibility = meshConfig.GetServiceEntryVisibility()
			}
			data, err := (proto.MarshalOptions{Deterministic: true}).Marshal(&visibilityConfig)
			if err != nil {
				log.Warningf("Unable to track ServiceEntry visibility configuration: %s", err)
			}
			version = sha256.Sum256(data)
			versions[meshConfig] = version
		}
		_, _ = digest.Write([]byte(ns))
		_, _ = digest.Write([]byte{0})
		_, _ = digest.Write(version[:])
	}
	return fmt.Sprintf("%x", digest.Sum(nil))
}
