package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/services/business"
)

type HealthAppender struct{}

// TODO: AppendGraph should probably get the options so that it can apply the
// proper interval to the health query.

// AppendGraph implements Appender. It appends Health information to nodes flagged
// as "isHealthIndicator"="true".
func (a HealthAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	business, err := business.Get()
	checkError(err)

	a.applyHealth(trafficMap, business)
}

func (a HealthAppender) applyHealth(trafficMap graph.TrafficMap, business *business.Layer) {
	for _, s := range trafficMap {
		// TODO FIX s.ServiceName, s.Name --> s.App to compile
		if s.App != graph.UnknownApp && s.Metadata["isHealthIndicator"] == true {
			// TODO: Health is not version specific, perhaps it should be, or at least the
			// parts where it is possible. For example, envoy is not version-specific
			health := business.Health.GetServiceHealth(s.Namespace, s.App, "10m")

			s.Metadata["health"] = &health
		}
	}
}
