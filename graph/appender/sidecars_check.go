package appender

import (
	"fmt"
	"github.com/kiali/kiali/services/business"
	"github.com/kiali/kiali/services/models"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type SidecarsCheckAppender struct {
	AccessibleNamespaces map[string]bool
}

// AppendGraph implements Appender
func (a SidecarsCheckAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	business, err := business.Get()
	checkError(err)

	a.applySidecarsChecks(trafficMap, business)
}

func (a *SidecarsCheckAppender) applySidecarsChecks(trafficMap graph.TrafficMap, business *business.Layer) {
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName
	istioNamespace := cfg.IstioNamespace

	for _, n := range trafficMap {

		// Skip the check on the sidecars if we don't have access to the namespace
		if _, found := a.AccessibleNamespaces[n.Namespace]; !found {
			continue
		}

		// We whitelist istio components because they may not report telemetry using injected sidecars.
		if n.Namespace == istioNamespace {
			continue
		}

		// dead nodes tell no tales (er, have no pods)
		if isDead, ok := n.Metadata["isDead"]; ok && isDead.(bool) {
			continue
		}

		// get the pods for the node, either by app+version labels, or workload deployment
		var err error
		var pods models.Pods
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			workload, err := business.Workload.GetWorkload(n.Namespace, n.Workload, false)
			if err == nil {
				pods = workload.Pods
			}
		case graph.NodeTypeApp:
			podLabels := a.getAppLabels(appLabel, n.App, versionLabel, n.Version)
			pods, err = business.Workload.GetPods(n.Namespace, podLabels)
		default:
			continue
		}
		checkError(err)

		if len(pods) == 0 {
			log.Warningf("Sidecar check found no pods Checking sidecars node [%s]", n.ID)
			continue
		}

		if !pods.HasIstioSideCar() {
			n.Metadata["hasMissingSC"] = true
		}
	}
}

func (a *SidecarsCheckAppender) getAppLabels(appLabel, app, versionLabel, version string) string {
	versionOk := version != "" && version != graph.UnknownVersion
	if versionOk {
		return fmt.Sprintf("%s=%s,%s=%s", appLabel, app, versionLabel, version)
	}
	return fmt.Sprintf("%s=%s", appLabel, app)
}

func (a *SidecarsCheckAppender) getWorkloadLabels(namespace, workload string, k8s kubernetes.IstioClientInterface) (string, error) {
	deployment, err := k8s.GetDeployment(namespace, workload)
	if err != nil {
		return "", err
	}
	return labels.Set(deployment.Spec.Selector.MatchLabels).String(), nil
}
