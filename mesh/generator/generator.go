package generator

import (
	"context"
	"crypto/md5"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/sliceutil"
)

type componentHealthKey struct {
	Cluster   string
	Name      string
	Namespace string
}

func (c componentHealthKey) String() string {
	return c.Name + c.Namespace + c.Cluster
}

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.Options, gi *mesh.GlobalInfo) (mesh.MeshMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	_, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	// get the current status info to determine versions
	statusInfo := mesh.StatusGetter(ctx, gi.Config, gi.ClientFactory, gi.KialiCache, gi.Grafana)
	esVersions := make(map[string]string)
	for _, es := range statusInfo.ExternalServices {
		esVersions[es.Name] = es.Version
	}

	// start by adding istio control planes and the mesh clusters
	meshDef, err := gi.Discovery.Mesh(ctx)
	graph.CheckError(err)

	// get istio status components (istiod, grafana, prometheus, tracing)
	istioStatus, err := gi.IstioStatusGetter.GetStatus(ctx)
	if errors.IsForbidden(err) {
		return nil, err
	}
	mesh.CheckError(err)

	// convert istio status slice into map
	healthData := map[string]string{}
	for _, data := range istioStatus {
		key := componentHealthKey{Name: data.Name, Namespace: data.Namespace, Cluster: data.Cluster}.String()
		healthData[key] = data.Status
	}

	clusterMap := make(map[string]bool)
	for _, cp := range meshDef.ControlPlanes {
		// Check if istio namespace is accessible for that cluster
		cpKey := mesh.GetClusterSensitiveKey(cp.Cluster.Name, cp.IstiodNamespace)
		if _, ok := o.AccessibleNamespaces[cpKey]; !ok {
			log.Tracef("No access for control plane %s in %s cluster", cp.IstiodNamespace, cp.Cluster.Name)
			continue
		}
		// add control plane cluster if not already added
		if _, ok := clusterMap[cp.Cluster.Name]; !ok {
			k8sVersion := esVersions[fmt.Sprintf("%s-%s", "Kubernetes", cp.Cluster.Name)]
			if k8sVersion == "" {
				k8sVersion = "Unknown"
			}
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cp.Cluster.Name, "", cp.Cluster.Name, cp.Cluster, k8sVersion, false, "")
			mesh.CheckError(err)
			clusterMap[cp.Cluster.Name] = true
		}

		name := cp.IstiodName

		version := "Unknown"
		if cp.Version != nil {
			version = cp.Version.Version
		}

		infraData := map[string]any{
			"config":     cp.Config,
			"revision":   cp.Revision,
			"thresholds": cp.Thresholds,
		}
		healthDataKey := componentHealthKey{Name: cp.IstiodName, Namespace: cp.IstiodNamespace, Cluster: cp.Cluster.Name}.String()
		istiod, _, err := addInfra(meshMap, mesh.InfraTypeIstiod, cp.Cluster.Name, cp.IstiodNamespace, name, infraData, version, false, healthData[healthDataKey])
		mesh.CheckError(err)

		for _, mc := range cp.ManagedClusters {
			// add managed clusters if not already added
			if _, ok := clusterMap[mc.Name]; !ok {
				_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, mc.Name, "", mc.Name, mc, "", false, "")
				mesh.CheckError(err)
				clusterMap[mc.Name] = true
			}

			// Add the managed namespaces for this cluster.
			namespaces := sliceutil.Filter(cp.ManagedNamespaces, func(ns models.Namespace) bool {
				return ns.Cluster == mc.Name
			})
			// We don't want empty dataplane nodes that aren't attached to any controlplane and they also break the UI.
			if len(namespaces) != 0 {
				// sort namespaces by cluster,name. This is more for test data consistency than anything else, but it doesn't hurt
				slices.SortFunc(namespaces, func(a, b models.Namespace) int {
					// Compare first bycluster and then by name
					if cmp := strings.Compare(a.Cluster, b.Cluster); cmp != 0 {
						return cmp
					}
					return strings.Compare(a.Name, b.Name)
				})
				// Show the tag instead of the revision name since that is what is actually set on the namespaces.
				rev := cp.Revision
				if cp.Tags != nil {
					for _, tag := range cp.Tags {
						if tag.Cluster == cp.Cluster.Name {
							// There should just be one tag pointing to this controlplane revision per cluster.
							rev = tag.Name
							break
						}
					}
				}
				dp, _, err := addInfra(meshMap, mesh.InfraTypeDataPlane, mc.Name, "", "Data Plane", namespaces, rev, false, "")
				graph.CheckError(err)
				istiod.AddEdge(dp)
			}
		}

		// add any Kiali instances
		conf := config.Get().Obfuscate()
		es := conf.ExternalServices
		hasExternalServices := false // external to the cluster/mesh (or a URL that can't be parsed)

		for _, ki := range cp.Cluster.KialiInstances {
			kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cp.Cluster.Name, ki.Namespace, ki.ServiceName, es.Istio, ki.Version, false, "")
			mesh.CheckError(err)

			if es.Istio.IstioAPIEnabled {
				kiali.AddEdge(istiod)
			}

			// add the Kiali external services...

			// metrics/prometheus
			cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi)
			var node *mesh.Node
			name := "Prometheus"
			node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, name, es.Prometheus, esVersions[name], isExternal, healthData["prometheus"])
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal

			if conf.ExternalServices.Tracing.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Tracing.InternalURL, ctx, gi)
				name = string(es.Tracing.Provider)
				node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, name, es.Tracing, esVersions[name], isExternal, healthData["tracing"])
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}

			if conf.ExternalServices.Grafana.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Grafana.InternalURL, ctx, gi)
				name = "Grafana"
				node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, name, es.Grafana, esVersions[name], isExternal, healthData["grafana"])
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}
		}

		if hasExternalServices {
			_, _, err = addInfra(meshMap, mesh.InfraTypeCluster, mesh.External, "", "External Deployments", nil, "", true, "")
			mesh.CheckError(err)
		}
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap, nil
}

func addInfra(meshMap mesh.MeshMap, infraType, cluster, namespace, name string, infraData interface{}, version string, isExternal bool, healthData string) (*mesh.Node, bool, error) {
	id, err := mesh.Id(cluster, namespace, name, infraType, version, isExternal)
	if err != nil {
		return nil, false, err
	}

	node, found := meshMap[id]
	if !found {
		newNode := mesh.NewNode(id, mesh.NodeTypeInfra, infraType, cluster, namespace, name)
		node = newNode
		meshMap[id] = node
	}

	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name)

	if infraData != nil {
		node.Metadata[mesh.InfraData] = infraData
	}

	if isExternal {
		node.Metadata[mesh.IsExternal] = true
	}

	if version != "" {
		node.Metadata[mesh.Version] = version
	}

	if healthData != "" {
		node.Metadata[mesh.HealthData] = healthData
	} else {
		node.Metadata[mesh.HealthData] = kubernetes.ComponentHealthy
	}

	return node, found, nil
}

// inMeshUrlRegexp is an array of regex to be matched, in order (most to least restrictive), against external service [inCluster] URLs
// if matching it will capture the namespace and service name.
var inMeshUrlRegexp = []*regexp.Regexp{
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)\.svc\.cluster\.local.*$`),
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)[:\/].*$`),
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+)$`),
}

// discoverInfraService tries to determine the cluster and namespace of a service, from its URL. Currently it's only
// targeting in-cluster URLs on the local cluster.  If it can't resolve the URL, or it can't fetch the resulting service,
// it assumes the URL is outside the mesh and returns ("", "", true).
func discoverInfraService(url string, ctx context.Context, gi *mesh.GlobalInfo) (cluster, namespace string, isExternal bool) {
	cluster = mesh.External
	isExternal = true
	namespace = ""

	if !graph.IsOK(url) {
		return
	}

	var matches []string
	for _, regexp := range inMeshUrlRegexp {
		matches = regexp.FindStringSubmatch(url)
		if matches != nil {
			break
		}
	}
	if matches == nil {
		return
	}

	svc, err := gi.Business.Svc.GetService(ctx, config.Get().KubernetesConfig.ClusterName, matches[2], matches[1])
	if err != nil {
		return
	}

	return svc.Cluster, svc.Namespace, false
}

func timeSeriesHash(cluster, namespace, name string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s", cluster, namespace, name))))
}
