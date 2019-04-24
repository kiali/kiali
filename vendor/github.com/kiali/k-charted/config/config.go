package config

import "github.com/kiali/k-charted/model"

type Config struct {
	PrometheusURL   string `yaml:"prometheus_url,omitempty"`
	GlobalNamespace string `yaml:"global_namespace,omitempty"`
	Errorf          func(string, ...interface{})
	Tracef          func(string, ...interface{})
	PodsLoader      func(string, string) ([]model.Pod, error)
}
