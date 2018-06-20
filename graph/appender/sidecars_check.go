package appender

import (
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
	for _, s := range trafficMap {
		if s.Name == graph.UnknownService {
			return
		}

		pods, err := k8s.GetServicePods(s.Namespace, s.ServiceName, s.Version)
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
