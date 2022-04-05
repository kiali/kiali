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

var client = *NewKialiClient()

var BOOKINFO = "bookinfo"

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

func ServicesList(namespace string) (*models.ServiceListJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/services", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		serviceList := new(models.ServiceListJson)
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

func ServiceDetails(name, namespace string) (*models.ServiceDetailsJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/services/"+name+"?validate=true&health=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		service := new(models.ServiceDetailsJson)
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

func WorkloadsList(namespace string) (*models.WorkloadListJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/workloads", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		wlList := new(models.WorkloadListJson)
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

func WorkloadDetails(name, namespace string) (*models.WorkloadJson, error) {
	body, _, _, err := httputil.HttpGet(client.kialiURL+"/api/namespaces/"+namespace+"/workloads/"+name+"?validate=true&health=true", client.GetAuth(), 10*time.Second, nil, client.kialiCookies)
	if err == nil {
		wl := new(models.WorkloadJson)
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
