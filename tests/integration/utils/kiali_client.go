package utils

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

type KialiClient struct {
	kialiURL     string
	kialiToken   string
	kialiCookies []*http.Cookie
	authStrategy string
}

type AuthStrategy struct {
	Strategy string `json:"strategy"`
}

// ObjectValidations represents a set of IstioValidation grouped by Object type and name.
type ObjectValidations map[string]map[string]*models.IstioValidation

type ServiceListJson struct {
	models.ServiceList
	// TODO merge with ServiceList and have IstioValidations instead
	Validations ObjectValidations `json:"validations"`
}

type ServiceDetailsJson struct {
	models.ServiceDetails
	// TODO merge with ServiceDetails and have IstioValidations instead
	Validations ObjectValidations `json:"validations"`
}

type WorkloadListJson struct {
	models.WorkloadList
	// TODO merge with WorkloadList and have IstioValidations instead
	Validations ObjectValidations `json:"validations"`
}

type WorkloadJson struct {
	models.Workload
	// TODO merge with Workload and have IstioValidations instead
	Validations ObjectValidations `json:"validations"`
}

type IstioConfigListJson struct {
	models.IstioConfigList
	// TODO merge with IstioConfigList and have IstioValidations instead
	IstioValidations ObjectValidations `json:"validations"`
}

var client = *NewKialiClient()

const BOOKINFO = "bookinfo"
const ASSETS = "tests/integration/assets"

func NewKialiClient() (c *KialiClient) {
	c = &KialiClient{
		kialiURL: os.Getenv("URL"),
	}
	if c.kialiURL == "" {
		log.Fatalf("URL environment variable is required. Kiali URL in 'https://kiali-hostname' format.")
		return
	}
	if strategy, err := c.KialiAuthStrategy(); err == nil {
		c.authStrategy = strategy
		if strategy == config.AuthStrategyOpenshift {
			c.kialiToken = os.Getenv("TOKEN")
			if c.kialiToken == "" {
				log.Fatalf("TOKEN environment variable is required by Kiali Auth strategy.")
				return
			}
			tokenResult, tokenCookies := c.GetCookies()
			if !tokenResult || tokenCookies == nil {
				log.Fatalf("Unable to login to the Kiali: %s by provided token: %s", c.kialiURL, c.kialiToken)
				return
			}
			c.kialiCookies = tokenCookies
		}
	} else {
		log.Fatalf("Unable to check Kiali auth strategy, Err: %s", err)
		return
	}
	return
}

func (c *KialiClient) KialiAuthStrategy() (string, error) {
	body, _, _, err := httputil.HttpGet(c.kialiURL+"/api/auth/info", c.GetAuth(), 10*time.Second, nil, nil)
	if err == nil {
		authStrategy := new(AuthStrategy)
		err = json.Unmarshal(body, &authStrategy)
		if err == nil {
			return authStrategy.Strategy, nil
		} else {
			return "", err
		}
	} else {
		return "", err
	}
}

func KialiStatus() (bool, int, error) {
	_, code, _, err := httputil.HttpGet(client.kialiURL+"/api/istio/status", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		return true, code, nil
	} else {
		return false, code, err
	}
}

func (c *KialiClient) GetAuth() *config.Auth {
	if c.authStrategy == config.AuthStrategyOpenshift {
		return &config.Auth{
			Token:              c.kialiToken,
			Type:               config.AuthTypeBearer,
			InsecureSkipVerify: true,
		}
	} else {
		return &config.Auth{
			InsecureSkipVerify: true,
		}
	}
}

func (c *KialiClient) GetCookies() (bool, []*http.Cookie) {
	auth := c.GetAuth()
	requestParams := url.Values{}
	requestParams.Set("access_token", auth.Token)
	requestParams.Set("expires_in", "86400")
	customHeaders := map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
	}
	_, code, cookies, err := httputil.HttpPost(c.kialiURL+"/api/authenticate", auth, strings.NewReader(requestParams.Encode()), 10*time.Second, customHeaders)
	if code == 200 && err == nil && cookies != nil {
		return true, cookies
	}
	return false, nil
}

func ApplicationsList(namespace string) (*models.AppList, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/apps", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		appList := new(models.AppList)
		err = json.Unmarshal(body, &appList)
		if err == nil {
			return appList, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func ApplicationDetails(name, namespace string) (*models.App, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/apps/"+name+"?health=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		app := new(models.App)
		err = json.Unmarshal(body, &app)
		if err == nil {
			return app, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func ServicesList(namespace string) (*ServiceListJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/services", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		serviceList := new(ServiceListJson)
		err = json.Unmarshal(body, &serviceList)
		if err == nil {
			return serviceList, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func ServiceDetails(name, namespace string) (*ServiceDetailsJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/services/"+name+"?validate=true&health=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		service := new(ServiceDetailsJson)
		err = json.Unmarshal(body, &service)
		if err == nil {
			return service, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func WorkloadsList(namespace string) (*WorkloadListJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/workloads", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		wlList := new(WorkloadListJson)
		err = json.Unmarshal(body, &wlList)
		if err == nil {
			return wlList, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func WorkloadDetails(name, namespace string) (*WorkloadJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/workloads/"+name+"?validate=true&health=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		wl := new(WorkloadJson)
		err = json.Unmarshal(body, &wl)
		if err == nil {
			return wl, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func IstioConfigsList(namespace string) (*IstioConfigListJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/istio?validate=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		configList := new(IstioConfigListJson)
		err = json.Unmarshal(body, &configList)
		if err == nil {
			return configList, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func IstioConfigDetails(namespace, name, configType string) (*models.IstioConfigDetails, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/istio/"+configType+"/"+name+"?validate=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		config := new(models.IstioConfigDetails)
		err = json.Unmarshal(body, &config)
		if err == nil {
			return config, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func IstioConfigPermissions(namespace string) (*models.IstioConfigPermissions, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/istio/permissions?namespaces="+namespace, client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		perms := new(models.IstioConfigPermissions)
		err = json.Unmarshal(body, &perms)
		if err == nil {
			return perms, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}
