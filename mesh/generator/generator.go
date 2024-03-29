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
	"github.com/kiali/kiali/observability"
)

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

	var temp *mesh.Node

	clusterMap := make(map[string]bool)
	for _, cp := range meshDef.ControlPlanes {
		if _, ok := clusterMap[cp.Cluster.Name]; !ok {
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cp.Cluster.Name, mesh.Unknown, cp.Cluster.Name, cp.Cluster)
			mesh.CheckError(err)
		}

		for _, mc := range cp.ManagedClusters {
			if _, ok := clusterMap[mc.Name]; ok {
				_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, mc.Name, mesh.Unknown, mc.Name, mc)
				mesh.CheckError(err)

				continue
			}
		}

		// add the control plane istiod
		name := cp.IstiodName
		if cp.Revision != "" {
			name = fmt.Sprintf("%s-%s", cp.IstiodName, cp.Revision)
		}
		istiod, _, err := addInfra(meshMap, mesh.InfraTypeIstiod, cp.Cluster.Name, cp.IstiodNamespace, name, cp.Config)
		mesh.CheckError(err)
		temp = istiod

		// add any Kiali instances
		conf := config.Get().Obfuscate()
		es := conf.ExternalServices
		hasExternalServices := false

		for _, ki := range cp.Cluster.KialiInstances {
			kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cp.Cluster.Name, ki.Namespace, ki.ServiceName, es.Istio)
			mesh.CheckError(err)

			if es.Istio.IstioAPIEnabled {
				kiali.AddEdge(istiod)
			}

			// add the Kiali external services...

			// metrics/prometheus
			cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi, force)
			var node *mesh.Node
			node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, "Prometheus", es.Prometheus)
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal

			if conf.ExternalServices.Tracing.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Tracing.InClusterURL, ctx, gi, force)
				node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, string(es.Tracing.Provider), es.Tracing)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}

			if conf.ExternalServices.Grafana.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Grafana.InClusterURL, ctx, gi, force)
				node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, "Grafana", es.Grafana)
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}
		}
		if hasExternalServices {
			_, _, err = addInfra(meshMap, mesh.InfraTypeCluster, mesh.Unknown, mesh.Unknown, "externalCluster", nil)
			mesh.CheckError(err)
		}
	}

	// start by creating infra nodes for each accessible namespace
	// note - namespace infra nodes will be converted, as needed, by namespace boxes at the config-gen stage (e.g. in Cytoscape.go)
	for _, ns := range o.AccessibleNamespaces {
		var err error
		dpns, _, err := addInfra(meshMap, mesh.InfraTypeNamespace, ns.Cluster, ns.Name, ns.Name, nil)
		mesh.CheckError(err)

		if ns.Name != "istio-system" {
			temp.AddEdge(dpns)
		}
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap
}

func addInfra(meshMap mesh.MeshMap, infraType, cluster, namespace, name string, infraData interface{}) (*mesh.Node, bool, error) {
	log.Infof("Adding Infra [%s][%s]", infraType, name)

	id, err := mesh.Id(cluster, namespace, name)
	if err != nil {
		return nil, false, err
	}
	node, found := meshMap[id]
	if !found {
		newNode := mesh.NewNodeExplicit(id, mesh.NodeTypeInfra, infraType, cluster, namespace, name)
		node = newNode
		meshMap[id] = node
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name)
	if infraData != nil {
		node.Metadata[mesh.InfraData] = infraData
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
// it assumes the URL is outside the mesh and returns (unknown, unknown, true).
func discoverInfraService(url string, ctx context.Context, gi *mesh.AppenderGlobalInfo, force bool) (cluster, namespace string, isExternal bool) {
	cluster = mesh.Unknown
	isExternal = true
	namespace = mesh.Unknown

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

	log.Infof("found svc=%+v", svc)
	return svc.Cluster, svc.Namespace, false
}

func timeSeriesHash(cluster, namespace, name string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s", cluster, namespace, name))))
}
