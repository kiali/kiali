package generator

import (
	"context"
	"crypto/sha256"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/perses"
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

// BuildMeshMap must produce a valid MeshMap. It is recommended to use the mesh/util.go definitions for error handling.
func BuildMeshMap(ctx context.Context, o mesh.Options, gi *mesh.GlobalInfo) (mesh.MeshMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	_, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	// get istio status components (istiod, grafana, prometheus, tracing)
	istioStatus, err := gi.IstioStatusGetter.GetStatus(ctx)
	if errors.IsForbidden(err) {
		return nil, err
	} else if err != nil {
		err = fmt.Errorf("when checking the health status of components in the mesh, an error occurred. Please correct the error then try again. Error: %w", err)
	}
	mesh.CheckError(err)

	// convert istio status slice into map
	healthData := map[string]string{}
	for _, data := range istioStatus {
		key := componentHealthKey{Name: data.Name, Namespace: data.Namespace, Cluster: data.Cluster}.String()
		healthData[key] = data.Status
	}

	grafanaHealthKey := componentHealthKey{Name: "grafana", Namespace: "", Cluster: gi.Conf.KubernetesConfig.ClusterName}.String()
	persesHealthKey := componentHealthKey{Name: "perses", Namespace: "", Cluster: gi.Conf.KubernetesConfig.ClusterName}.String()
	promHealthKey := componentHealthKey{Name: "prometheus", Namespace: "", Cluster: gi.Conf.KubernetesConfig.ClusterName}.String()
	tracingHealthKey := componentHealthKey{Name: "tracing", Namespace: "", Cluster: gi.Conf.KubernetesConfig.ClusterName}.String()

	// get the current status info to determine versions
	var grafanaService *grafana.Service
	if gi.Grafana != nil && healthData[grafanaHealthKey] == kubernetes.ComponentHealthy {
		grafanaService = gi.Grafana
	}
	// get the current status info to determine versions
	var persesService *perses.Service
	if gi.Perses != nil && healthData[persesHealthKey] == kubernetes.ComponentHealthy {
		persesService = gi.Perses
	}
	kialiStatus := mesh.StatusGetter(ctx, gi.Conf, gi.ClientFactory, gi.KialiCache, grafanaService, persesService)
	esVersions := make(map[string]string)
	for _, es := range kialiStatus.ExternalServices {
		esVersions[es.Name] = es.Version
	}

	// start by adding istio control planes and the mesh clusters
	meshDef, err := gi.Discovery.Mesh(ctx)
	graph.CheckError(err)

	clusterMap := make(map[string]bool)
	conf := gi.Conf.Obfuscate()
	es := conf.ExternalServices
	hasExternalServices := false // external to the cluster/mesh (or a URL that can't be parsed)

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

		healthDataKey := componentHealthKey{Name: cp.IstiodName, Namespace: cp.IstiodNamespace, Cluster: cp.Cluster.Name}.String()
		istiod, _, err := addInfra(meshMap, mesh.InfraTypeIstiod, cp.Cluster.Name, cp.IstiodNamespace, name, cp, version, false, healthData[healthDataKey])
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
				if cp.Tag != nil {
					// There should just be one tag pointing to this controlplane revision per cluster.
					rev = cp.Tag.Name
				}
				dp, _, err := addInfra(meshMap, mesh.InfraTypeDataPlane, mc.Name, "", "Data Plane", namespaces, rev, false, "")
				graph.CheckError(err)
				istiod.AddEdge(dp)
			}
		}

		// add any Kiali instances
		for _, ki := range cp.Cluster.KialiInstances {
			kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cp.Cluster.Name, ki.Namespace, ki.ServiceName, es.Istio, ki.Version, false, "")
			mesh.CheckError(err)

			es := conf.ExternalServices

			if es.Istio.IstioAPIEnabled {
				kiali.AddEdge(istiod)
			}

			// add the Kiali external services...

			// metrics/prometheus
			cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi)
			var node *mesh.Node
			name := "Prometheus"
			node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, name, es.Prometheus, esVersions[name], isExternal, healthData[promHealthKey])
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal

			if conf.ExternalServices.Tracing.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Tracing.InternalURL, ctx, gi)
				name = string(es.Tracing.Provider)
				node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, name, es.Tracing, esVersions[name], isExternal, healthData[tracingHealthKey])
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}

			if conf.ExternalServices.Grafana.Enabled {
				cluster, namespace, isExternal = discoverInfraService(es.Grafana.InternalURL, ctx, gi)
				name = "Grafana"
				node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, name, es.Grafana, esVersions[name], isExternal, healthData[grafanaHealthKey])
				mesh.CheckError(err)

				kiali.AddEdge(node)
				hasExternalServices = hasExternalServices || isExternal
			}
		}

		if hasExternalServices {
			_, _, err = addInfra(meshMap, mesh.InfraTypeCluster, mesh.External, "", "External Deployments", nil, "", true, "")
			mesh.CheckError(err)
		}

		// if ambient, add ztunnel
		if gi.KialiCache.IsAmbientEnabled(cp.Cluster.Name) {
			ztunnels, err := gi.Business.Workload.GetAllWorkloads(ctx, cp.Cluster.Name, fmt.Sprintf("%s=%s", config.IstioAppLabel, config.Ztunnel))
			mesh.CheckError(err)

			for _, ztunnel := range ztunnels {
				var infraData interface{}

				if len(ztunnel.Pods) > 0 {
					dump := gi.Business.Workload.GetZtunnelConfig(ztunnel.Cluster, ztunnel.Namespace, ztunnel.Pods[0].Name)
					// The dump can be huge, just return the config part and defer to the ztunnel workload tab for the other stuff
					if dump != nil {
						infraData = dump.Config
					}
				}

				// if we couldn't fetch a ztunnel config, just return labels and annotation
				if infraData == nil {
					infraData = struct {
						Annotations         map[string]string
						Labels              map[string]string
						TemplateAnnotations map[string]string
						TemplateLabels      map[string]string
					}{
						Annotations:         ztunnel.Annotations,
						Labels:              ztunnel.Labels,
						TemplateAnnotations: ztunnel.TemplateAnnotations,
						TemplateLabels:      ztunnel.TemplateLabels,
					}
				}

				version := models.DefaultRevisionLabel
				if rev, ok := ztunnel.Labels[config.IstioRevisionLabel]; ok {
					version = rev
				}

				ztunnelNode, _, err := addInfra(meshMap, mesh.InfraTypeZtunnel, ztunnel.Cluster, ztunnel.Namespace, ztunnel.Name, infraData, version, false, "")
				mesh.CheckError(err)

				// add edge to the managing control plane
				for _, infraNode := range meshMap {
					if infraNode.InfraType == mesh.InfraTypeIstiod && infraNode.Cluster == ztunnel.Cluster {
						cp := infraNode.Metadata[mesh.InfraData].(models.ControlPlane)
						tag := "default"
						if cp.Tag != nil {
							tag = cp.Tag.Name
						}
						if tag == ztunnelNode.Metadata[mesh.Version] {
							infraNode.AddEdge(ztunnelNode)
							break
						}
					}
				}
			}
		}

		// if included, add any waypoints
		if o.IncludeWaypoints {
			for _, wp := range gi.Business.Workload.GetWaypoints(ctx) {
				// fetch the detail for each waypoint because we need the waypoint workloads and/or services
				criteria := business.WorkloadCriteria{
					Cluster: wp.Cluster, Namespace: wp.Namespace, WorkloadName: wp.Name,
				}
				wp, err = gi.Business.Workload.GetWorkload(ctx, criteria)
				mesh.CheckError(err)

				version := models.DefaultRevisionLabel
				if rev, ok := wp.Labels[config.IstioRevisionLabel]; ok {
					version = rev
				}

				infraData := struct {
					Annotations         map[string]string
					Labels              map[string]string
					TemplateAnnotations map[string]string
					TemplateLabels      map[string]string
				}{
					Annotations:         wp.Annotations,
					Labels:              wp.Labels,
					TemplateAnnotations: wp.TemplateAnnotations,
					TemplateLabels:      wp.TemplateLabels,
				}

				wpNode, _, err := addInfra(meshMap, mesh.InfraTypeWaypoint, wp.Cluster, wp.Namespace, wp.Name, infraData, version, false, "")
				mesh.CheckError(err)

				// add edge to the managing control plane
				for _, infraNode := range meshMap {
					if infraNode.InfraType == mesh.InfraTypeIstiod && infraNode.Cluster == wp.Cluster {
						cp := infraNode.Metadata[mesh.InfraData].(models.ControlPlane)
						tag := "default"
						if cp.Tag != nil {
							tag = cp.Tag.Name
						}
						if tag == wpNode.Metadata[mesh.Version] {
							infraNode.AddEdge(wpNode)
							break
						}
					}
				}
			}
		}

		// if included, add gateways
		if o.IncludeGateways {
			criteria := business.IstioConfigCriteria{
				IncludeGateways:    true,
				IncludeK8sGateways: true,
			}
			configMap, err := gi.Business.IstioConfig.GetIstioConfigMap(ctx, "", criteria)
			mesh.CheckError(err)

			for cluster, conf := range configMap {
				gwNodes := []*mesh.Node{}
				for _, gw := range conf.Gateways {
					version := models.DefaultRevisionLabel
					if rev, ok := gw.Labels[config.IstioRevisionLabel]; ok {
						version = rev
					}
					gwNode, _, err := addInfra(meshMap, mesh.InfraTypeGateway, cluster, gw.Namespace, gw.Name, gw, version, false, "")
					mesh.CheckError(err)
					gwNodes = append(gwNodes, gwNode)
				}
				for _, gw := range conf.K8sGateways {
					// skip waypoints because they are treated independently
					if strings.Contains(strings.ToLower(string(gw.Spec.GatewayClassName)), "waypoint") {
						continue
					}
					version := models.DefaultRevisionLabel
					if rev, ok := gw.Labels[config.IstioRevisionLabel]; ok {
						version = rev
					}
					gwNode, _, err := addInfra(meshMap, mesh.InfraTypeGateway, cluster, gw.Namespace, gw.Name, gw, version, false, "")
					mesh.CheckError(err)
					gwNodes = append(gwNodes, gwNode)
				}

				// add edge to the managing control plane
				for _, infraNode := range meshMap {
					if infraNode.InfraType != mesh.InfraTypeIstiod || infraNode.Cluster != cluster {
						continue
					}
					cp := infraNode.Metadata[mesh.InfraData].(models.ControlPlane)
					tag := "default"
					if cp.Tag != nil {
						tag = cp.Tag.Name
					}
					for _, gwNode := range gwNodes {
						if tag == gwNode.Metadata[mesh.Version] {
							infraNode.AddEdge(gwNode)
						}
					}
				}
			}
		}
	}

	if meshDef.ExternalKiali != nil {
		cluster := meshDef.ExternalKiali.Cluster.Name

		// add external cluster if not already added
		if _, ok := clusterMap[cluster]; !ok {
			k8sVersion := esVersions[fmt.Sprintf("%s-%s", "Kubernetes", cluster)]
			if k8sVersion == "" {
				k8sVersion = "Unknown"
			}
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cluster, "", cluster, cluster, k8sVersion, false, "")
			mesh.CheckError(err)
			clusterMap[cluster] = true
		}

		ek := meshDef.ExternalKiali.Kiali
		kiali, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cluster, ek.Namespace, ek.ServiceName, es.Istio, ek.Version, false, "")
		mesh.CheckError(err)

		if es.Istio.IstioAPIEnabled {
			for _, infra := range meshMap {
				if infra.InfraType == mesh.InfraTypeIstiod {
					kiali.AddEdge(infra)
				}
			}
		}

		// add the Kiali external services...

		// metrics/prometheus
		cluster, namespace, isExternal := discoverInfraService(es.Prometheus.URL, ctx, gi)
		var node *mesh.Node
		name := "Prometheus"
		node, _, err = addInfra(meshMap, mesh.InfraTypeMetricStore, cluster, namespace, name, es.Prometheus, esVersions[name], isExternal, healthData[promHealthKey])
		mesh.CheckError(err)

		kiali.AddEdge(node)
		hasExternalServices = hasExternalServices || isExternal

		if conf.ExternalServices.Tracing.Enabled {
			cluster, namespace, isExternal = discoverInfraService(es.Tracing.InternalURL, ctx, gi)
			name = string(es.Tracing.Provider)
			node, _, err = addInfra(meshMap, mesh.InfraTypeTraceStore, cluster, namespace, name, es.Tracing, esVersions[name], isExternal, healthData[tracingHealthKey])
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal
		}

		if conf.ExternalServices.Grafana.Enabled {
			cluster, namespace, isExternal = discoverInfraService(es.Grafana.InternalURL, ctx, gi)
			name = "Grafana"
			node, _, err = addInfra(meshMap, mesh.InfraTypeGrafana, cluster, namespace, name, es.Grafana, esVersions[name], isExternal, healthData[grafanaHealthKey])
			mesh.CheckError(err)

			kiali.AddEdge(node)
			hasExternalServices = hasExternalServices || isExternal
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
	regexp.MustCompile(`^h.+\/\/\d+?\.\d+?\.\d+?\.\d+?.*$`),            // weed out IP-based urls, which we can't use for discovery
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)\.svc\.cluster\.local.*$`), // http://(namespace).(service).svc.cluster.local...
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+?)[:\/].*$`),                 // http://(namespace).(service):port... or http://(namespace).(service)/...
	regexp.MustCompile(`^h.+\/\/(.+?)\.(.+)$`),                         // http://(namespace).(service)
}

// discoverInfraService tries to determine the cluster and namespace of a service, from its URL. Currently it's only
// targeting internal URLs. If it can't resolve the URL, or it can't fetch the resulting service,
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
	if matches == nil || len(matches) != 3 {
		return
	}

	svc, err := gi.Business.Svc.GetService(ctx, gi.Conf.KubernetesConfig.ClusterName, matches[2], matches[1])
	if err != nil {
		return
	}

	return svc.Cluster, svc.Namespace, false
}

func timeSeriesHash(cluster, namespace, name string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(strings.Join([]string{cluster, namespace, name}, ":"))))
}
