package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func TestGetKialiDiscoverySelectors(t *testing.T) {
	assert.Nil(t, getKialiDiscoverySelectors("a", nil))

	// config with no selectors defined
	cfgNoSelectors := config.Config{
		Deployment: config.DeploymentConfig{
			DiscoverySelectors: config.DiscoverySelectorsConfig{
				Default:   nil,
				Overrides: nil,
			},
		},
	}
	// config with only default selectors that match things with either (a) label1 and label1a or (b) label2
	cfgDefaultSelectors := config.Config{
		Deployment: config.DeploymentConfig{
			DiscoverySelectors: config.DiscoverySelectorsConfig{
				Default: config.DiscoverySelectorsType{
					&config.DiscoverySelectorType{
						MatchLabels: map[string]string{"label1": "labelValue1"},
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "label1a",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"labelValue1a"},
							},
						},
					},
					&config.DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "label2",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"labelValue2"},
							},
						},
					},
				},
				Overrides: nil,
			},
		},
	}
	// config with only "cluster1" override selectors that match things with either (a) label3 or (b) label4
	cfgOverrideSelectors := config.Config{
		Deployment: config.DeploymentConfig{
			DiscoverySelectors: config.DiscoverySelectorsConfig{
				Default: nil,
				Overrides: map[string]config.DiscoverySelectorsType{
					"cluster1": {
						&config.DiscoverySelectorType{
							MatchLabels: map[string]string{"label3": "labelValue3"},
						},
						&config.DiscoverySelectorType{
							MatchExpressions: []meta_v1.LabelSelectorRequirement{
								{
									Key:      "label4",
									Operator: meta_v1.LabelSelectorOpIn,
									Values:   []string{"labelValue4"},
								},
							},
						},
					},
				},
			},
		},
	}
	// config with default selectors that match things with either (a) label1 and label1a or (b) label2
	// and with "cluster1" override selectors that match things with either (a) label3 or (b) label4
	cfgDefaultAndOverrideSelectors := config.Config{
		Deployment: config.DeploymentConfig{
			DiscoverySelectors: config.DiscoverySelectorsConfig{
				Default: config.DiscoverySelectorsType{
					&config.DiscoverySelectorType{
						MatchLabels: map[string]string{"label1": "labelValue1"},
					},
					&config.DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "label2",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"labelValue2"},
							},
						},
					},
				},
				Overrides: map[string]config.DiscoverySelectorsType{
					"cluster1": {
						&config.DiscoverySelectorType{
							MatchLabels: map[string]string{"label3": "labelValue3"},
						},
						&config.DiscoverySelectorType{
							MatchExpressions: []meta_v1.LabelSelectorRequirement{
								{
									Key:      "label4",
									Operator: meta_v1.LabelSelectorOpIn,
									Values:   []string{"labelValue4"},
								},
							},
						},
					},
				},
			},
		},
	}

	// namespaces we are going to test with
	fooNamespace := models.Namespace{
		Name: "foo",
	}
	oneNamespace := models.Namespace{
		Name:   "one",
		Labels: map[string]string{"label1": "labelValue1", "label1a": "labelValue1a"},
	}
	twoNamespace := models.Namespace{
		Name:   "two",
		Labels: map[string]string{"label2": "labelValue2"},
	}
	threeNamespace := models.Namespace{
		Name:   "three",
		Labels: map[string]string{"label3": "labelValue3"},
	}
	fourNamespace := models.Namespace{
		Name:   "four",
		Labels: map[string]string{"label4": "labelValue4"},
	}

	cases := map[string]struct {
		config            config.Config
		clusterName       string
		allNamespaces     []models.Namespace
		matchedNamespaces []models.Namespace
	}{
		"no selectors - no namespaces": {
			config:            cfgNoSelectors,
			clusterName:       "unknown",
			allNamespaces:     nil,
			matchedNamespaces: nil,
		},
		"default selectors - no namespaces": {
			config:            cfgDefaultSelectors,
			clusterName:       "unknown",
			allNamespaces:     nil,
			matchedNamespaces: nil,
		},
		"override selectors - no namespaces": {
			config:            cfgOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     nil,
			matchedNamespaces: nil,
		},
		"default/override selectors - no namespaces": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     nil,
			matchedNamespaces: nil,
		},
		"no selectors - all namespaces": {
			config:            cfgNoSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
			matchedNamespaces: []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
		},
		"default selectors - all namespaces": {
			config:            cfgDefaultSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
			matchedNamespaces: []models.Namespace{oneNamespace, twoNamespace},
		},
		"override selectors - all namespaces - unknown cluster (there are no default selectors, so everything is getting selected)": {
			config:            cfgOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
			matchedNamespaces: []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
		},
		"default/override selectors - all namespaces - unknown cluster (so defaults take effect)": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
			matchedNamespaces: []models.Namespace{oneNamespace, twoNamespace},
		},
		"default/override selectors - all namespaces - cluster1 cluster (so overrides take effect)": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "cluster1",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace, twoNamespace, threeNamespace, fourNamespace},
			matchedNamespaces: []models.Namespace{threeNamespace, fourNamespace},
		},
		"default/override selectors - only foo namespace - unknown cluster (foo doesn't match anything)": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace},
			matchedNamespaces: []models.Namespace{},
		},
		"default/override selectors - only foo namespace - cluster1 cluster (foo doesn't match anything)": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "cluster1",
			allNamespaces:     []models.Namespace{fooNamespace},
			matchedNamespaces: []models.Namespace{},
		},
		"default selectors - foo and one namespaces": {
			config:            cfgDefaultSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace},
			matchedNamespaces: []models.Namespace{oneNamespace},
		},
		"override selectors - foo and one namespaces (there are no defaults and since unknown doesn't have overrides, no selectors means match everything)": {
			config:            cfgOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, oneNamespace},
			matchedNamespaces: []models.Namespace{fooNamespace, oneNamespace},
		},
		"override selectors - foo and three namespaces": {
			config:            cfgOverrideSelectors,
			clusterName:       "cluster1",
			allNamespaces:     []models.Namespace{fooNamespace, threeNamespace},
			matchedNamespaces: []models.Namespace{threeNamespace},
		},
		"default/override selectors - foo and three namespaces - unknown cluster (neither matches)": {
			config:            cfgDefaultAndOverrideSelectors,
			clusterName:       "unknown",
			allNamespaces:     []models.Namespace{fooNamespace, threeNamespace},
			matchedNamespaces: []models.Namespace{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			// make sure our config can marshal and unmarshal the config
			yaml, err := config.Marshal(&tc.config)
			assert.Nil(err)
			config, err := config.Unmarshal(yaml)
			assert.Nil(err)

			selectors := getKialiDiscoverySelectors(tc.clusterName, config)
			filteredNamespaces := filterNamespacesWithDiscoverySelectors(tc.allNamespaces, selectors)
			assert.Equal(tc.matchedNamespaces, filteredNamespaces)
		})
	}
}

func TestGetDiscoverySelectorsForCluster(t *testing.T) {
	assert.Nil(t, getDiscoverySelectorsForCluster("cluster1", nil))

	// config with only "cluster1" override selectors
	overrideSelectors := config.Config{
		IstioNamespace: "istio-system",
		Deployment: config.DeploymentConfig{
			DiscoverySelectors: config.DiscoverySelectorsConfig{
				Default: nil,
				Overrides: map[string]config.DiscoverySelectorsType{
					"cluster1": {
						&config.DiscoverySelectorType{
							MatchLabels: map[string]string{"label2": "labelValue2"},
						},
					},
				},
			},
		},
	}

	// namespaces we are going to test with
	fooNamespace := models.Namespace{
		Name: "foo",
	}
	istioNamespace := models.Namespace{
		Name:   "istio-system",
		Labels: map[string]string{"kubernetes.io/metadata.name": "istio-system"},
	}
	oneNamespace := models.Namespace{
		Name:   "one",
		Labels: map[string]string{"label1": "labelValue1"},
	}
	twoNamespace := models.Namespace{
		Name:   "two",
		Labels: map[string]string{"label2": "labelValue2"},
	}

	cases := map[string]struct {
		clusterName       string
		config            config.Config
		allNamespaces     []models.Namespace
		matchedNamespaces []models.Namespace
	}{
		"override discovery selectors - cluster has overrides so use the overrides": {
			clusterName:       "cluster1",
			config:            overrideSelectors,
			allNamespaces:     []models.Namespace{fooNamespace, istioNamespace, oneNamespace, twoNamespace},
			matchedNamespaces: []models.Namespace{istioNamespace, twoNamespace},
		},
		"override discovery selectors - cluster does NOT have overrides": {
			clusterName:       "unknown-cluster",
			config:            overrideSelectors,
			allNamespaces:     []models.Namespace{fooNamespace, istioNamespace, oneNamespace, twoNamespace},
			matchedNamespaces: []models.Namespace{fooNamespace, istioNamespace, oneNamespace, twoNamespace},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			selectors := getDiscoverySelectorsForCluster(tc.clusterName, &tc.config)
			filteredNamespaces := filterNamespacesWithDiscoverySelectors(tc.allNamespaces, selectors)
			assert.Equal(tc.matchedNamespaces, filteredNamespaces)
		})
	}
}
