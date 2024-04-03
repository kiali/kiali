package generator

import (
	"context"
	"crypto/md5"
	"fmt"
	"math/rand"
	"regexp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
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

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.Options, gi *mesh.AppenderGlobalInfo) mesh.MeshMap {
	force := r.Intn(100) < 50

	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	_, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	// Kiali instances will be configured with the external services with which they communicate. If possible, we want to
	// show these service nodes in the mesh, positioned in the proper cluster and namespaces.  To do this we look for
	// the service deployments.  If not found (or not accessible to the user) we assume the services are deployed
	// externally and we fall back to the configured URLs.  So, start by trying to discover the infra services...
	//infraServices := discoverInfraServices(gi)

	// start by adding istio control planes and the mesh clusters
	meshDef, err := gi.Business.Mesh.GetMesh(ctx)
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

	clusterMap := make(map[string]bool)
	for _, cp := range meshDef.ControlPlanes {
		// add control plane cluster if not already added
		if _, ok := clusterMap[cp.Cluster.Name]; !ok {
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cp.Cluster.Name, "", cp.Cluster.Name, cp.Cluster, false)
			mesh.CheckError(err)
		}

		// add managed clusters if not already added
		for _, mc := range cp.ManagedClusters {
			if _, ok := clusterMap[mc.Name]; ok {
				_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, mc.Name, "", mc.Name, mc, false)
				mesh.CheckError(err)

				continue
			}
		}

		// add the control plane istiod revision
		name := cp.IstiodName
		if cp.Revision != "" {
			name = fmt.Sprintf("%s-%s", cp.IstiodName, cp.Revision)
		}
		istiod, _, err := addInfra(meshMap, mesh.InfraTypeIstiod, cp.Cluster.Name, cp.IstiodNamespace, name, cp.Config, false)
		mesh.CheckError(err)

		// add the managed namespaces by cluster and narrowed, if necessary, by revision
		dataplaneMap := make(map[string][]models.Namespace)
		cpNamespaces := namespaces
		if isCanary {
			cpNamespaces = canaryPending
			if cp.Revision == canaryStatus.UpgradeVersion {
				cpNamespaces = canaryMigrated
			}
		}
		for _, ns := range cpNamespaces {
			clusterNamespaces := dataplaneMap[ns.Cluster]
			if clusterNamespaces == nil {
				clusterNamespaces = []models.Namespace{}
			}
			dataplaneMap[ns.Cluster] = append(clusterNamespaces, ns)
		}
		for cluster, namespaces := range dataplaneMap {
			dp, _, err := addInfra(meshMap, mesh.InfraTypeDataPlane, cluster, "", "Data Plane", namespaces, false)
			graph.CheckError(err)

			istiod.AddEdge(dp)
		}

		// add any Kiali instances
		conf := config.Get().Obfuscate()
		es := conf.ExternalServices
		hasExternalServices := false // external to the cluster/mesh (or a URL that can't be parsed)

		for _, ki := range cp.Cluster.KialiInstances {
			kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cp.Cluster.Name, ki.Namespace, ki.ServiceName, es.Istio, false)
			mesh.CheckError(err)

			if es.Istio.IstioAPIEnabled {
				kiali.AddEdge(istiod)
			}

			// add the Kiali external services...

			// metrics/prometheus
			cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi, force)
			var node *mesh.Node
			node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, "Prometheus", es.Prometheus, isExternal)
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal

			if conf.ExternalServices.Tracing.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Tracing.InClusterURL, ctx, gi, force)
				node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, string(es.Tracing.Provider), es.Tracing, isExternal)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}

			if conf.ExternalServices.Grafana.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Grafana.InClusterURL, ctx, gi, force)
				node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, "Grafana", es.Grafana, isExternal)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}
		}
		if hasExternalServices {
			_, _, err = addInfra(meshMap, mesh.InfraTypeCluster, mesh.External, "", "External Deployments", nil, true)
			mesh.CheckError(err)
		}
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap
}

func addInfra(meshMap mesh.MeshMap, infraType, cluster, namespace, name string, infraData interface{}, isExternal bool) (*mesh.Node, bool, error) {
	log.Infof("Adding Infra [%s][%s]", infraType, name)

	id, err := mesh.Id(cluster, namespace, name, infraType, isExternal)
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
	return node, found, nil
}

// inMeshUrlRegexp is an array of regex to be matched, in order (most to least restrictive), against external service [inCluster] URLs
// if matching it will capture the namespace and service name.
var inMeshUrlRegexp = []*regexp.Regexp{
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)\.svc\.cluster\.local.*$`),
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)[:\/].*$`),
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+)$`),
}

var r = rand.New(rand.NewSource(99))

// discoverInfraService tries to determine the cluster and namespace of a service, from its URL. Currently it's only
// targeting in-cluster URLs on the local cluster.  If it can't resolve the URL, or it can't fetch the resulting service,
// it assumes the URL is outside the mesh and returns ("", "", true).
func discoverInfraService(url string, ctx context.Context, gi *mesh.AppenderGlobalInfo, force bool) (cluster, namespace string, isExternal bool) {
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
	if matches == nil || force {
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
