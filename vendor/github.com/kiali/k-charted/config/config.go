package config

import (
	"github.com/kiali/k-charted/config/promconfig"
	"github.com/kiali/k-charted/model"
)

type Config struct {
	Prometheus      promconfig.PrometheusConfig `yaml:"prometheus"`
	GlobalNamespace string                      `yaml:"global_namespace"`
	Errorf          func(string, ...interface{})
	Tracef          func(string, ...interface{})
	PodsLoader      func(string, string) ([]model.Pod, error)
}
