package main

import (
	"testing"

	"github.com/kiali/kiali/config"
)

func TestValidateWebRoot(t *testing.T) {
	// create a base config that we know is valid
	conf := config.NewConfig()
	conf.Server.StaticContentRootDirectory = "."
	conf.Auth.Strategy = "anonymous"

	// now test some web roots, both valid ones and invalid ones
	validWebRoots := []string{
		"/",
		"/kiali",
		"/abc/clustername/api/v1/namespaces/istio-system/services/kiali:80/proxy/kiali",
		"/a/0/-/./_/~/!/$/&/'/(/)/*/+/,/;/=/:/@/%aa",
		"/kiali0-._~!$&'()*+,;=:@%aa",
	}
	invalidWebRoots := []string{
		"/kiali/",
		"kiali/",
		"/^kiali",
		"/foo/../bar",
		"/../bar",
		"../bar",
	}

	for _, webroot := range validWebRoots {
		conf.Server.WebRoot = webroot
		config.Set(conf)
		if err := validateConfig(); err != nil {
			t.Errorf("Web root validation should have succeeded for [%v]: %v", conf.Server.WebRoot, err)
		}
	}

	for _, webroot := range invalidWebRoots {
		conf.Server.WebRoot = webroot
		config.Set(conf)
		if err := validateConfig(); err == nil {
			t.Errorf("Web root validation should have failed [%v]", conf.Server.WebRoot)
		}
	}
}
