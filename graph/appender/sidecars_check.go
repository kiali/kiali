package appender

import (
	"fmt"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/business/checkers"
)

type SidecarsCheckAppender struct {
	GraphType string
	Versioned bool
}

// AppendGraph implements Appender
func (a SidecarsCheckAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	k8s, err := kubernetes.NewClient()
	checkError(err)

	a.applySidecarsChecks(trafficMap, k8s)
}

func (a *SidecarsCheckAppender) applySidecarsChecks(trafficMap graph.TrafficMap, k8s *kubernetes.IstioClient) {
	appLabel := config.Get().AppLabelName
	versionLabel := config.Get().VersionLabelName

	for _, n := range trafficMap {
		// dead nodes have no pods
		if isDead, ok := n.Metadata["isDead"]; ok && isDead.(bool) {
			continue
		}

		// get the pods for the node, either by app+version labels, or workload deployment
		var podLabels string
		var err error
		switch a.GraphType {
		case graph.GraphTypeApp:
			podLabels = a.getAppLabels(appLabel, n.App, versionLabel, n.Version)
		case graph.GraphTypeWorkload:
			podLabels, err = a.getWorkloadLabels(n.Namespace, n.Workload, k8s)
			if err != nil {
				continue
			}
		case graph.GraphTypeAppPreferred:
			if n.App != graph.UnknownApp && (!a.Versioned || n.Version != graph.UnknownVersion) {
				podLabels = a.getAppLabels(appLabel, n.App, versionLabel, n.Version)
			} else {
				podLabels, err = a.getWorkloadLabels(n.Namespace, n.Workload, k8s)
				if err != nil {
					continue
				}
			}
		}

		pods, err := k8s.GetPods(n.Namespace, podLabels)
		checkError(err)

		if len(pods.Items) == 0 {
			log.Warningf("Sidecar check found no pods Checking sidecars node [%s] num pods [%v]", n.ID, len(pods.Items))
		}

		// check each pod for sidecar, stop and flag at first pod missing sidecar
		checker := checkers.PodChecker{Pods: pods.Items}
		validations := checker.Check()

		for _, check := range validations {
			if !check.Valid {
				n.Metadata["hasMissingSC"] = true
				break
			}
		}
	}
}

func (a *SidecarsCheckAppender) getAppLabels(appLabel, app, versionLabel, version string) string {
	if a.Versioned {
		return fmt.Sprintf("%s=%s,%s=%s", appLabel, app, versionLabel, version)
	}
	return fmt.Sprintf("%s=%s", appLabel, app)
}

func (a *SidecarsCheckAppender) getWorkloadLabels(namespace, workload string, k8s *kubernetes.IstioClient) (string, error) {
	deployment, err := k8s.GetDeployment(namespace, workload)
	if err != nil {
		return "", err
	}
	return labels.Set(deployment.Spec.Selector.MatchLabels).String(), nil
}
