package appender

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers"
)

type SidecarsCheckAppender struct{}

// AppendGraph implements Appender
func (a SidecarsCheckAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	k8s, err := kubernetes.NewClient()
	checkError(err)

	a.applySidecarsChecks(trafficMap, k8s)
}

func (a SidecarsCheckAppender) applySidecarsChecks(trafficMap graph.TrafficMap, k8s *kubernetes.IstioClient) {
	appLabel := config.Get().AppLabelName
	versionLabel := config.Get().VersionLabelName

	for _, s := range trafficMap {
		// TODO FIX s.ServiceName, s.Name --> s.App to compile
		if s.App == graph.UnknownApp {
			return
		}

		pods, err := k8s.GetPods(s.Namespace, fmt.Sprintf("%s=%s,%s=%s", appLabel, s.App, versionLabel, s.Version))
		checkError(err)

		checker := checkers.PodChecker{Pods: pods.Items}
		validations := checker.Check()

		sidecarsOk := true
		for _, check := range validations {
			sidecarsOk = sidecarsOk && check.Valid
		}
		s.Metadata["hasMissingSC"] = !sidecarsOk
	}
}
