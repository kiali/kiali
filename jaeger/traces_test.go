package jaeger

import (
	"testing"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"
	"github.com/stretchr/testify/assert"
)

func TestMatchingWorkload(t *testing.T) {
	assert := assert.New(t)

	trace := jaegerModels.Trace{
		Spans: []jaegerModels.Span{{
			ProcessID: "process_1",
			Tags: []jaegerModels.KeyValue{{
				Key:   "dummy",
				Value: "dummy",
			}, {
				Key:   "node_id",
				Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.default~default.svc.cluster.local",
			}},
		}, {
			ProcessID: "process_2",
			Tags: []jaegerModels.KeyValue{{
				Key:   "dummy",
				Value: "dummy",
			}},
		}},
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"process_1": {
				Tags: []jaegerModels.KeyValue{{
					Key:   "dummy",
					Value: "dummy",
				}},
			},
			"process_2": {
				Tags: []jaegerModels.KeyValue{{
					Key:   "dummy",
					Value: "dummy",
				}, {
					Key:   "hostname",
					Value: "my-pod-123456-789abc",
				}},
			},
		},
	}

	assert.False(matchesWorkload(trace, "default", "some-workload"))
	assert.True(matchesWorkload(trace, "default", "reviews"))
	assert.True(matchesWorkload(trace, "default", "my-pod"))
}
