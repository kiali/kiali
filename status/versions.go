package status

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

func getVersions(ctx context.Context, conf *config.Config, clientFactory kubernetes.ClientFactory, grafana *grafana.Service) []models.ExternalServiceInfo {
	components := getKubernetesVersions(clientFactory)

	pv, err := prometheusVersion(conf, clientFactory.GetSAHomeClusterClient())
	if err != nil {
		log.Infof("Error getting Prometheus version: %v", err)
	} else {
		components = append(components, *pv)
	}

	if conf.ExternalServices.Grafana.Enabled {
		gv, err := grafanaVersion(ctx, grafana, conf.ExternalServices.Grafana, clientFactory.GetSAHomeClusterClient())
		if err != nil {
			log.Infof("Error getting Grafana version: %v", err)
		} else {
			components = append(components, *gv)
		}
	} else {
		log.Debugf("Grafana is disabled in Kiali by configuration")
	}

	if conf.ExternalServices.Tracing.Enabled {
		tv, err := tracingVersion(conf, clientFactory.GetSAHomeClusterClient())
		if err != nil {
			log.Infof("Error getting Tracing version: %v", err)
		} else {
			components = append(components, *tv)
		}
	} else {
		log.Debugf("Tracing is disabled in Kiali by configuration")
	}

	return components
}

type p8sResponseVersion struct {
	Version  string `json:"version"`
	Revision string `json:"revision"`
}

type jaegerResponseVersion struct {
	Version string `json:"gitVersion"`
}

type tempoResponseVersion struct {
	Version   string `json:"version"`
	Revision  string `json:"revision"`
	Branch    string `json:"branch"`
	BuildUser string `json:"buildUser"`
	BuildDate string `json:"buildDate"`
	GoVersion string `json:"goVersion"`
}

func tracingVersion(conf *config.Config, homeClusterSAClient kubernetes.ClientInterface) (*models.ExternalServiceInfo, error) {
	tracingConfig := conf.ExternalServices.Tracing

	if !tracingConfig.Enabled {
		return nil, nil
	}

	product := models.ExternalServiceInfo{}
	product.Name = string(tracingConfig.Provider)
	product.Url = tracingConfig.URL

	if product.Url != "" {
		// try to determine version by querying
		if tracingConfig.Provider == config.JaegerProvider {
			auth := tracingConfig.Auth
			if auth.UseKialiToken {
				auth.Token = homeClusterSAClient.GetToken()
			}
			body, statusCode, _, err := httputil.HttpGet(product.Url, &auth, 10*time.Second, nil, nil)
			if err != nil || statusCode > 399 {
				log.Infof("jaeger version check failed: url=[%v], code=[%v]", product.Url, statusCode)
			} else {
				// Jaeger does not provide api to get version, so it is obtained from js function inside html main page
				// const JAEGER_VERSION = {"gitCommit: xxx, gitVersion: yyy, buildDate: zzz"}
				bodyStr := string(body)
				jaegerVersionConst := "const JAEGER_VERSION = "
				jsonStartIndex := strings.Index(bodyStr, jaegerVersionConst) + len(jaegerVersionConst)
				jsonEndIndex := jsonStartIndex + strings.Index(bodyStr[jsonStartIndex:], ";") // version json ends with ;
				jaegerVersion := bodyStr[jsonStartIndex:jsonEndIndex]

				jaegerV := new(jaegerResponseVersion)
				err = json.Unmarshal([]byte(jaegerVersion), &jaegerV)
				if err == nil {
					product.Version = jaegerV.Version
				}
			}
		} else {
			// Tempo
			if tracingConfig.Provider == config.TempoProvider {
				body, statusCode, _, err := httputil.HttpGet(fmt.Sprintf("%s/api/status/buildinfo", product.Url), nil, 10*time.Second, nil, nil)
				if err != nil || statusCode > 399 {
					log.Infof("tempo version check failed: url=[%v], code=[%v]", product.Url, statusCode)
				} else {
					tempoV := new(tempoResponseVersion)
					err = json.Unmarshal(body, &tempoV)
					if err == nil {
						product.Version = tempoV.Version
					}
				}
			}
		}
	}

	product.TempoConfig = tracingConfig.TempoConfig

	return &product, nil
}

type grafanaBuildInfo struct {
	Version string `json:"version"`
}

type grafanaResponseVersion struct {
	BuildInfo grafanaBuildInfo `json:"buildInfo"`
}

func grafanaVersion(ctx context.Context, grafana *grafana.Service, grafanaConfig config.GrafanaConfig, homeClusterSAClient kubernetes.ClientInterface) (*models.ExternalServiceInfo, error) {
	product := models.ExternalServiceInfo{}
	product.Name = "Grafana"
	product.Url = grafana.URL(ctx)
	if product.Url != "" {
		// try to determine version by querying
		url := fmt.Sprintf("%s/api/frontend/settings", product.Url)
		// Be sure to copy config.Auth and not modify the existing
		auth := grafanaConfig.Auth
		if auth.UseKialiToken {
			auth.Token = homeClusterSAClient.GetToken()
		}
		body, statusCode, _, err := httputil.HttpGet(url, &auth, 10*time.Second, nil, nil)

		if err != nil || statusCode > 399 {
			log.Infof("grafana version check failed: url=[%v], code=[%v]", url, statusCode)
		} else {
			grafanaV := new(grafanaResponseVersion)
			err = json.Unmarshal(body, &grafanaV)
			if err == nil {
				product.Version = grafanaV.BuildInfo.Version
			}
		}
	}

	return &product, nil
}

func prometheusVersion(conf *config.Config, homeClusterSAClient kubernetes.ClientInterface) (*models.ExternalServiceInfo, error) {
	product := models.ExternalServiceInfo{}
	prometheusV := new(p8sResponseVersion)
	cfg := conf.ExternalServices.Prometheus

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		auth.Token = homeClusterSAClient.GetToken()
	}

	body, _, _, err := httputil.HttpGet(cfg.URL+"/version", &auth, 10*time.Second, nil, nil)
	if err == nil {
		err = json.Unmarshal(body, &prometheusV)
		if err == nil {
			product.Name = "Prometheus"
			product.Version = prometheusV.Version
			return &product, nil
		}
	}
	return nil, err
}

func getKubernetesVersions(clientFactory kubernetes.ClientFactory) []models.ExternalServiceInfo {
	// Use the Kiali Service Account client to get the Kubernetes version
	// since the status endpoint does not have a user token.
	// Loop through all SA clients to get Kubernetes versions of all clusters
	var k8sVersions []models.ExternalServiceInfo
	for clusterName, saClient := range clientFactory.GetSAClients() {
		serverVersion, err := saClient.GetServerVersion()
		if err != nil {
			log.Debugf("Unable to get Kubernetes version for cluster [%s]: %v", clusterName, err)
			continue
		}

		k8sVersions = append(k8sVersions, models.ExternalServiceInfo{
			Name:    fmt.Sprintf("%s-%s", "Kubernetes", clusterName),
			Version: serverVersion.GitVersion,
		})
	}

	return k8sVersions
}
