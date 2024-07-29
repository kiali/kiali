package generator

import (
	"cmp"
	"context"
	"crypto/md5"
	"fmt"
	"regexp"
	"slices"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

func getNamespacesByName(name string, namespaces []models.Namespace) []models.Namespace {
	result := []models.Namespace{}
	for _, ns := range namespaces {
		if name == ns.Name {
			result = append(result, ns)
		}
	}
	return result
}

type componentHealthKey struct {
	Cluster   string
	Name      string
	Namespace string
}

func (c componentHealthKey) String() string {
	return c.Name + c.Namespace + c.Cluster
}

type clusterRevisionKey struct {
	Cluster  string
	Revision string
}

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.Options, gi *mesh.AppenderGlobalInfo) mesh.MeshMap {
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

	namespaces, err := gi.Business.Namespace.GetNamespaces(ctx)
	graph.CheckError(err)

	canaryStatus, err := gi.Business.Mesh.CanaryUpgradeStatus()
	graph.CheckError(err)

	canaryMigrated := []models.Namespace{}
	canaryPending := []models.Namespace{}
	isCanary := mesh.IsOK(canaryStatus.CurrentVersion) && mesh.IsOK(canaryStatus.UpgradeVersion)
	if isCanary {
		for _, name := range canaryStatus.MigratedNamespaces {
			canaryMigrated = append(canaryMigrated, getNamespacesByName(name, namespaces)...)
		}
		for _, name := range canaryStatus.PendingNamespaces {
			canaryPending = append(canaryPending, getNamespacesByName(name, namespaces)...)
		}
	}

	// get istio status components (istiod, grafana, prometheus, tracing)
	istioStatus, err := gi.IstioStatusGetter.GetStatus(ctx)
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
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cp.Cluster.Name, "", cp.Cluster.Name, cp.Cluster, k8sVersion, false, "", false)
			mesh.CheckError(err)
			clusterMap[cp.Cluster.Name] = true
		}

		// add managed clusters if not already added
		for _, mc := range cp.ManagedClusters {
			if _, ok := clusterMap[mc.Name]; !ok {
				_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, mc.Name, "", mc.Name, mc, "", false, "", false)
				mesh.CheckError(err)
				clusterMap[mc.Name] = true

				continue
			}
		}

		name := cp.IstiodName

		version := "Unknown"
		if cp.Version != nil {
			version = cp.Version.Version
		}

		infraData := map[string]any{
			"config":     cp.Config,
			"configMap":  cp.ConfigMap,
			"revision":   cp.Revision,
			"thresholds": cp.Thresholds,
		}
		healthDataKey := componentHealthKey{Name: cp.IstiodName, Namespace: cp.IstiodNamespace, Cluster: cp.Cluster.Name}.String()
		istiod, _, err := addInfra(meshMap, mesh.InfraTypeIstiod, cp.Cluster.Name, cp.IstiodNamespace, name, infraData, version, false, healthData[healthDataKey], false)
		mesh.CheckError(err)

		managedClusters := make(map[string]struct{})
		for _, mc := range cp.ManagedClusters {
			managedClusters[mc.Name] = struct{}{}
		}
		// add the managed namespaces by cluster and narrowed, if necessary, by revision
		dataplaneMap := make(map[clusterRevisionKey][]models.Namespace)
		cpNamespaces := namespaces
		if isCanary {
			cpNamespaces = canaryPending
			if cp.Revision == canaryStatus.UpgradeVersion {
				cpNamespaces = canaryMigrated
			}
		}
		for _, ns := range cpNamespaces {
			nsRev := ns.Labels["istio.io/rev"]
			if nsRev == "" {
				nsRev = "default"
			}
			key := clusterRevisionKey{Cluster: ns.Cluster, Revision: nsRev}
			clusterNamespaces := dataplaneMap[key]
			if clusterNamespaces == nil {
				clusterNamespaces = []models.Namespace{}
			}

			_, managesCluster := managedClusters[ns.Cluster]
			if cp.IstiodNamespace != ns.Name && cp.Revision == nsRev && managesCluster {
				dataplaneMap[key] = append(clusterNamespaces, ns)
			}
		}
		for clusterrev, namespaces := range dataplaneMap {
			// sort namespaces by cluster,name. This is more for test data consistency than anything else, but it doesn't hurt
			slices.SortFunc(namespaces, func(a, b models.Namespace) int {
				clusterComp := cmp.Compare(a.Cluster, b.Cluster)
				if clusterComp != 0 {
					return clusterComp
				}
				return cmp.Compare(a.Name, b.Name)
			})

			isDataPlaneCanary := isCanary && cp.Revision == canaryStatus.UpgradeVersion

			// Note that version here is not the actual istio version, but the revision of the control plane that is managing this dataplane.
			dp, _, err := addInfra(meshMap, mesh.InfraTypeDataPlane, clusterrev.Cluster, "", "Data Plane", namespaces, cp.Revision, false, "", isDataPlaneCanary)
			graph.CheckError(err)

			istiod.AddEdge(dp)
		}

		// add any Kiali instances
		conf := config.Get().Obfuscate()
		es := conf.ExternalServices
		hasExternalServices := false // external to the cluster/mesh (or a URL that can't be parsed)

		for _, ki := range cp.Cluster.KialiInstances {
			kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cp.Cluster.Name, ki.Namespace, ki.ServiceName, es.Istio, ki.Version, false, "", false)
			mesh.CheckError(err)

			if es.Istio.IstioAPIEnabled {
				kiali.AddEdge(istiod)
			}

			// add the Kiali external services...

			// metrics/prometheus
			cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi)
			var node *mesh.Node
			name := "Prometheus"
			node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, name, es.Prometheus, esVersions[name], isExternal, healthData["prometheus"], false)
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal

			if conf.ExternalServices.Tracing.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Tracing.InClusterURL, ctx, gi)
				name = string(es.Tracing.Provider)
				node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, name, es.Tracing, esVersions[name], isExternal, healthData["tracing"], false)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}

			if conf.ExternalServices.Grafana.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Grafana.InClusterURL, ctx, gi)
				name = "Grafana"
				node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, name, es.Grafana, esVersions[name], isExternal, healthData["grafana"], false)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}
		}

		if hasExternalServices {
			_, _, err = addInfra(meshMap, mesh.InfraTypeCluster, mesh.External, "", "External Deployments", nil, "", true, "", false)
			mesh.CheckError(err)
		}
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap
}

func addInfra(meshMap mesh.MeshMap, infraType, cluster, namespace, name string, infraData interface{}, version string, isExternal bool, healthData string, isCanary bool) (*mesh.Node, bool, error) {
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

	if isCanary {
		node.Metadata[mesh.IsCanary] = true
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
func discoverInfraService(url string, ctx context.Context, gi *mesh.AppenderGlobalInfo) (cluster, namespace string, isExternal bool) {
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
