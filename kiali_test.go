package main

import (
	"math/rand"
	"testing"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

func TestValidateWebRoot(t *testing.T) {
	// create a base config that we know is valid
	rand.Seed(time.Now().UnixNano())
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = util.RandomString(10)
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

func TestValidateAuthStrategy(t *testing.T) {
	// create a base config that we know is valid
	rand.Seed(time.Now().UnixNano())
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = util.RandomString(10)
	conf.Server.StaticContentRootDirectory = "."

	// now test some auth strategies, both valid ones and invalid ones
	validStrategies := []string{
		config.AuthStrategyAnonymous,
		config.AuthStrategyOpenId,
		config.AuthStrategyOpenshift,
		config.AuthStrategyToken,
	}
	invalidStrategies := []string{
		"login",
		"ldap",
		"",
		"foo",
	}

	for _, strategies := range validStrategies {
		conf.Auth.Strategy = strategies
		config.Set(conf)
		if err := validateConfig(); err != nil {
			t.Errorf("Auth Strategy validation should have succeeded for [%v]: %v", conf.Auth.Strategy, err)
		}
	}

	for _, strategies := range invalidStrategies {
		conf.Auth.Strategy = strategies
		config.Set(conf)
		if err := validateConfig(); err == nil {
			t.Errorf("Auth Strategy validation should have failed [%v]", conf.Auth.Strategy)
		}
	}
}
