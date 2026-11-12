package troubleshooting

import "strings"

// Issue and sub-problem ids share one scheme so each kind of problem can be
// recognized from the id alone.
//
//	{kind}-{scope}
//
// kind is a short prefix: cp, dp, mesh, k8s, istio, sec, traffic, obs, conn.
// A category that is one issue for the whole mesh uses a fixed id ({kind}-001).
// A sub-problem appends the objects it describes. Parts are lowercased and
// separators (space, /, :, arrows) become "-". Empty parts are dropped.
//
//	cp-001                                      control plane issue
//	cp-{cluster}-{namespace}-{name}             one control plane node
//	cp-status                                   control plane status with no node
//	dp-{cluster}-{namespace}                    one unhealthy namespace
//	dp-{cluster}-{namespace}-ns                 the namespace itself
//	dp-{cluster}-{namespace}-{type}-{name}      service, workload, app, or argoapp
//	dp-ztunnel / dp-ztunnel-ds / dp-ztunnel-pod-{name}  ambient ztunnel
//	mesh-{cluster}-{namespace}-xds-{workload}   Envoy xDS desynchronization
//	mesh-{cluster}-{namespace}-sidecar-{wl}     missing sidecar in injection-enabled namespace
//	mesh-{cluster}-{namespace}-version-{wl}     outdated proxy version vs control plane
//	k8s-{cluster}-{namespace}-{wl}-{pod}        pod lifecycle failure (CrashLoopBackOff, OOMKilled, etc.)
//	k8s-{cluster}-{namespace}-endpoints-{svc}   service with 0 active endpoints
//	sec-001                                     security / mTLS / Ambient policy issue
//	sec-ambient-{namespace}-{kind}-{name}       Ambient L7 policy missing waypoint or targetRefs
//	sec-mtls-{cluster}-{namespace}              namespace mTLS partially enabled or disabled
//	sec-plaintext-{namespace}-{from}-{to}       plaintext traffic edge
//	traffic-001                                 traffic anomaly issue
//	traffic-edge-{namespace}-{from}-{to}        failing or degraded traffic edge
//	traffic-latency-{namespace}-{from}-{to}     high response latency edge
//	traffic-egress-{namespace}-{from}-{target}  BlackHoleCluster or PassthroughCluster traffic
//	obs-001                                     observability issue
//	obs-{component}                             grafana, jaeger, prometheus, ...
//	conn-001                                    connectivity issue
//	conn-{from}-{to}                            one unhealthy edge
//	istio-001                                   Istio config issue
//	istio-{namespace}-{kind}-{name}             one Istio object and all of its checks

const (
	idConnectivity       = "conn-001"
	idControlPlane       = "cp-001"
	idControlPlaneStatus = "cp-status"
	idDataPlaneZtunnel   = "dp-ztunnel"
	idDataPlaneZtunnelDS = "dp-ztunnel-ds"
	idIstioConfig        = "istio-001"
	idObservability      = "obs-001"
	idSecurity           = "sec-001"
	idTraffic            = "traffic-001"
)

func controlPlaneNodeID(cluster, namespace, name string) string {
	return slug("cp", cluster, namespace, name)
}

func dataPlaneNamespaceID(cluster, namespace string) string {
	return slug("dp", cluster, namespace)
}

func dataPlaneNamespaceSubProblemID(cluster, namespace string) string {
	return slug("dp", cluster, namespace, "ns")
}

func dataPlaneResourceID(cluster, namespace, resourceType, name string) string {
	return slug("dp", cluster, namespace, resourceType, name)
}

func dataPlaneConfigID(cluster, namespace, resourceType, name string) string {
	return slug("dp", cluster, namespace, "config", resourceType, name)
}

func dataPlaneZtunnelPodID(podName string) string {
	return slug("dp", "ztunnel", "pod", podName)
}

func meshSyncID(cluster, namespace, workload string) string {
	return slug("mesh", cluster, namespace, "xds", workload)
}

func meshSidecarInjectionID(cluster, namespace, workload string) string {
	return slug("mesh", cluster, namespace, "sidecar", workload)
}

func meshProxyVersionID(cluster, namespace, workload string) string {
	return slug("mesh", cluster, namespace, "version", workload)
}

func k8sPodLifecycleID(cluster, namespace, workload, pod string) string {
	return slug("k8s", cluster, namespace, workload, pod)
}

func k8sServiceEndpointsID(cluster, namespace, service string) string {
	return slug("k8s", cluster, namespace, "endpoints", service)
}

func istioObjectID(namespace, kind, name string) string {
	return slug("istio", namespace, kind, name)
}

func securityAmbientPolicyID(namespace, kind, name string) string {
	return slug("sec", "ambient", namespace, kind, name)
}

func securityNamespaceMTLSID(cluster, namespace string) string {
	return slug("sec", "mtls", cluster, namespace)
}

func securityPlaintextEdgeID(namespace, from, to string) string {
	return slug("sec", "plaintext", namespace, from, to)
}

func trafficEdgeID(namespace, from, to string) string {
	return slug("traffic", "edge", namespace, from, to)
}

func trafficLatencyID(namespace, from, to string) string {
	return slug("traffic", "latency", namespace, from, to)
}

func trafficEgressID(namespace, from, target string) string {
	return slug("traffic", "egress", namespace, from, target)
}

func observabilityComponentID(name string) string {
	return slug("obs", name)
}

func connectivityEdgeID(from, to string) string {
	return slug("conn", from, to)
}

func slug(parts ...string) string {
	var out []string
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		p = strings.ReplaceAll(p, " ", "-")
		p = strings.ReplaceAll(p, "/", "-")
		p = strings.ReplaceAll(p, ":", "-")
		p = strings.ReplaceAll(p, "→", "-")
		p = strings.ReplaceAll(p, "—", "-")
		p = strings.ReplaceAll(p, "(", "")
		p = strings.ReplaceAll(p, ")", "")
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return "issue"
	}
	return strings.Join(out, "-")
}
