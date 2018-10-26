package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

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
