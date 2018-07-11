package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func TestFilterByDestination(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.False(t, FilterByDestination(nil, "", "", ""))

	spec := map[string]interface{}{
		"destination": map[string]interface{}{
			"name": "reviews",
		},
	}

	assert.True(t, FilterByDestination(spec, "ignored", "reviews", "ignored"))
	assert.False(t, FilterByDestination(spec, "ignored", "", "ignored"))
	assert.False(t, FilterByDestination(spec, "ignored", "reviews-bad", "ignored"))

	spec = map[string]interface{}{
		"destination": map[string]interface{}{
			"name":      "reviews",
			"namespace": "bookinfo",
		},
	}

	assert.True(t, FilterByDestination(spec, "bookinfo", "reviews", "ignored"))
	assert.False(t, FilterByDestination(spec, "bookinfo", "", "ignored"))
	assert.False(t, FilterByDestination(spec, "bookinfo-bad", "reviews", "ignored"))
	assert.False(t, FilterByDestination(spec, "bookinfo", "reviews-bad", "ignored"))

	spec = map[string]interface{}{
		"destination": map[string]interface{}{
			"name":      "reviews",
			"namespace": "bookinfo",
			"labels": map[string]interface{}{
				"version": "v1",
			},
		},
	}

	assert.True(t, FilterByDestination(spec, "bookinfo", "reviews", ""))
	assert.True(t, FilterByDestination(spec, "bookinfo", "reviews", "v1"))
	assert.False(t, FilterByDestination(spec, "bookinfo", "reviews", "v2"))
	assert.False(t, FilterByDestination(spec, "bookinfo", "", ""))
	assert.False(t, FilterByDestination(spec, "bookinfo", "", "ignored"))
	assert.False(t, FilterByDestination(spec, "bookinfo-bad", "reviews", "v1"))
	assert.False(t, FilterByDestination(spec, "bookinfo", "reviews-bad", "v1"))
}

func TestFilterByHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo.svc.cluster.local", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad.svc.cluster.local", "reviews", "bookinfo"))
}

func TestCheckVirtualService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.False(t, CheckVirtualService(nil, "", "", nil))

	virtualService := MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
			"http": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": 50,
						},
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v3",
							},
							"weight": 50,
						},
					},
				},
			},
		},
	}

	assert.True(t, CheckVirtualService(&virtualService, "", "reviews", []string{"v1", "v2", "v3"}))
	assert.False(t, CheckVirtualService(&virtualService, "", "reviews", []string{"v1"}))

	virtualService = MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
			"tcp": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": 50,
						},
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v3",
							},
							"weight": 50,
						},
					},
				},
			},
		},
	}

	assert.True(t, CheckVirtualService(&virtualService, "", "reviews", []string{"v1", "v2", "v3"}))
	assert.False(t, CheckVirtualService(&virtualService, "", "reviews", []string{"v1"}))
}

func TestGetDestinationRulesSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.Equal(t, []string{}, GetDestinationRulesSubsets(nil, "", ""))

	destinationRule1 := MockIstioObject{
		Spec: map[string]interface{}{
			"host": "reviews",
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
	}
	destinationRule2 := MockIstioObject{
		Spec: map[string]interface{}{
			"host": "reviews",
			"trafficPolicy": map[string]interface{}{
				"loadBalancer": map[string]interface{}{
					"simple": "LEAST_CONN",
				},
			},
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "testversion",
					"labels": map[string]interface{}{
						"version": "v2",
					},
					"trafficPolicy": map[string]interface{}{
						"loadBalancer": map[string]interface{}{
							"simple": "ROUND_ROBIN",
						},
					},
				},
			},
		},
	}

	destinationRules := []IstioObject{&destinationRule1, &destinationRule2}

	assert.Equal(t, []string{"v2", "testversion"}, GetDestinationRulesSubsets(destinationRules, "reviews", "v2"))
}

func TestCheckDestinationRuleCircuitBreaker(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.False(t, CheckDestinationRuleCircuitBreaker(nil, "", "", ""))

	destinationRule1 := MockIstioObject{
		Spec: map[string]interface{}{
			"host": "reviews",
			"trafficPolicy": map[string]interface{}{
				"connectionPool": map[string]interface{}{
					"http": map[string]interface{}{
						"maxRequestsPerConnection": 100,
					},
				},
				"outlierDetection": map[string]interface{}{
					"http": map[string]interface{}{
						"consecutiveErrors": 50,
					},
				},
			},
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
	}

	assert.True(t, CheckDestinationRuleCircuitBreaker(&destinationRule1, "", "reviews", "v1"))
	assert.True(t, CheckDestinationRuleCircuitBreaker(&destinationRule1, "", "reviews", "v2"))
	assert.False(t, CheckDestinationRuleCircuitBreaker(&destinationRule1, "", "reviews-bad", "v2"))

	destinationRule2 := MockIstioObject{
		Spec: map[string]interface{}{
			"host": "reviews",
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
					"trafficPolicy": map[string]interface{}{
						"connectionPool": map[string]interface{}{
							"http": map[string]interface{}{
								"maxRequestsPerConnection": 100,
							},
						},
						"outlierDetection": map[string]interface{}{
							"http": map[string]interface{}{
								"consecutiveErrors": 50,
							},
						},
					},
				},
			},
		},
	}

	assert.False(t, CheckDestinationRuleCircuitBreaker(&destinationRule2, "", "reviews", "v1"))
	assert.True(t, CheckDestinationRuleCircuitBreaker(&destinationRule2, "", "reviews", "v2"))
	assert.False(t, CheckDestinationRuleCircuitBreaker(&destinationRule2, "", "reviews-bad", "v2"))
}

func TestFQDNHostname(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews.bookinfo.svc", "reviews", "bookinfo"))
	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("reviews.foo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.foo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.bookinfo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.bookinfo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.foo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.foo.svc.cluster.local", "reviews", "bookinfo"))
}
