package troubleshooting

import "strings"

// Issue and sub-problem ids share one scheme so each kind of problem can be
// recognized from the id alone.
//
//	{kind}-{scope}
//
// kind is a short prefix: cp, dp, obs, conn.
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
//	dp-ztunnel / dp-ztunnel-ds                  ambient ztunnel
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

func istioObjectID(namespace, kind, name string) string {
	return slug("istio", namespace, kind, name)
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
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return "issue"
	}
	return strings.Join(out, "-")
}
