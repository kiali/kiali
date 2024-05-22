package status

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

type externalService func() (*ExternalServiceInfo, error)

var (
	// Example OpenShift Service Mesh 1.1 product version is:
	//   OSSM_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean
	// Example Istio snapshot version is:
	//   root@f72e3d3ef3c2-docker.io/istio-release-1.0-20180927-21-10-cbe9c05c470ec1924f7bcf02334b183e7e6175cb-Clean
	// Example Istio alpha RC version is:
	//   1.7.0-alpha.1-cd46a166947eac363380c3aa3523b26a8c391f98-dirty-Modified
	// Example Istio dev version is:
	//   1.5-alpha.dbd2aca8887fb42c2bb358417621a78de372f906-dbd2aca8887fb42c2bb358417621a78de372f906-Clean
	//   1.10-dev-65a124dc2ab69f91331298fbf6d9b4335abcf0fd-Clean
	ossmVersionExpr          = regexp.MustCompile(`(?:OSSM_|openshift-service-mesh-)([0-9]+\.[0-9]+\.[0-9]+)`)
	istioDevVersionExpr      = regexp.MustCompile(`(\d+\.\d+)-alpha\.([[:alnum:]]+)-.*|(\d+\.\d+)-dev-([[:alnum:]]+)-.*`)
	istioRCVersionExpr       = regexp.MustCompile(`(\d+\.\d+.\d+)-((?:alpha|beta|rc|RC)\.\d+)`)
	istioSnapshotVersionExpr = regexp.MustCompile(`istio-release-([0-9]+\.[0-9]+)(-[0-9]{8})`)
	istioVersionExpr         = regexp.MustCompile(`([0-9]+\.[0-9]+\.[0-9]+)`)
)

const (
	istioProductNameOSSM             = "OpenShift Service Mesh"
	istioProductNameUpstream         = "Istio"
	istioProductNameUpstreamSnapshot = "Istio Snapshot"
	istioProductNameUpstreamRC       = "Istio RC"
	istioProductNameUpstreamDev      = "Istio Dev"
	istioProductNameUnknown          = "Unknown Istio Implementation"
)

func getVersions() {
	components := getKubernetesVersion()

	components = append(components, istioVersion, prometheusVersion)

	if config.Get().ExternalServices.Grafana.Enabled {
		components = append(components, grafanaVersion)
	} else {
		log.Debugf("Grafana is disabled in Kiali by configuration")
	}

	if config.Get().ExternalServices.Tracing.Enabled {
		components = append(components, tracingVersion)
	} else {
		log.Debugf("Tracing is disabled in Kiali by configuration")
	}

	for _, comp := range components {
		getVersionComponent(comp)
	}
}

func getVersionComponent(serviceComponent externalService) {
	componentInfo, err := serviceComponent()
	if err == nil {
		info.ExternalServices = append(info.ExternalServices, *componentInfo)
	}
}

// istioVersion returns the current istio version information
func istioVersion() (*ExternalServiceInfo, error) {
	istioConfig := config.Get().ExternalServices.Istio
	body, code, _, err := httputil.HttpGet(istioConfig.UrlServiceVersion, nil, 10*time.Second, nil, nil)

	configWarnings := "failed to get mesh version, please check if url_service_version is configured correctly."

	if err != nil {
		AddWarningMessages(configWarnings)
		return nil, fmt.Errorf(configWarnings)
	}
	if code >= 400 {
		return nil, fmt.Errorf("getting istio version returned error code [%d]", code)
	}
	rawVersion := string(body)

	istioInfo := parseIstioRawVersion(rawVersion)
	meshName, meshVersion := istioInfo.Name, istioInfo.Version

	Put(MeshVersion, meshVersion)
	Put(MeshName, meshName)

	return istioInfo, nil
}

func parseIstioRawVersion(rawVersion string) *ExternalServiceInfo {
	product := ExternalServiceInfo{Name: "Unknown", Version: "Unknown"}

	// First see if it is upstream Istio (either a release or snapshot).
	// If it is not then it is some unknown Istio implementation that we do not support.

	// OpenShift Service Mesh
	ossmStringArr := ossmVersionExpr.FindStringSubmatch(rawVersion)
	if ossmStringArr != nil {
		log.Debugf("Detected OpenShift Service Mesh version [%v]", rawVersion)
		if len(ossmStringArr) > 1 {
			product.Name = istioProductNameOSSM
			product.Version = ossmStringArr[1] // get regex group #1 ,which is the "#.#.#" version string

			// we know this is OpenShift Service Mesh - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a snapshot version of Istio
	istioVersionStringArr := istioSnapshotVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio snapshot version [%v]", rawVersion)
		if len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamSnapshot
			majorMinor := istioVersionStringArr[1]  // regex group #1 is the "#.#" version numbers
			snapshotStr := istioVersionStringArr[2] // regex group #2 is the date/time stamp
			product.Version = majorMinor + snapshotStr

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is an RC version of Istio
	istioVersionStringArr = istioRCVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio RC version [%v]", rawVersion)
		if len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamRC
			majorMinor := istioVersionStringArr[1] // regex group #1 is the "#.#.#" version numbers
			rc := istioVersionStringArr[2]         // regex group #2 is the alpha or beta version
			product.Version = fmt.Sprintf("%s (%s)", majorMinor, rc)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a dev version of Istio
	istioVersionStringArr = istioDevVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio dev version [%v]", rawVersion)
		if strings.Contains(istioVersionStringArr[0], "alpha") && len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamDev
			majorMinor := istioVersionStringArr[1] // regex group #1 is the "#.#" version numbers
			buildHash := istioVersionStringArr[2]  // regex group #2 is the build hash
			product.Version = fmt.Sprintf("%s (dev %s)", majorMinor, buildHash)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		} else if strings.Contains(istioVersionStringArr[0], "dev") && len(istioVersionStringArr) > 4 {
			product.Name = istioProductNameUpstreamDev
			majorMinor := istioVersionStringArr[3] // regex group #3 is the "#.#" version numbers
			buildHash := istioVersionStringArr[4]  // regex group #4 is the build hash
			product.Version = fmt.Sprintf("%s (dev %s)", majorMinor, buildHash)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a released version of Istio
	istioVersionStringArr = istioVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio version [%v]", rawVersion)
		if len(istioVersionStringArr) > 1 {
			product.Name = istioProductNameUpstream
			product.Version = istioVersionStringArr[1] // get regex group #1 ,which is the "#.#.#" version string

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	log.Debugf("Detected unknown Istio implementation version [%v]", rawVersion)
	product.Name = istioProductNameUnknown
	product.Version = rawVersion
	return &product
}

type p8sResponseVersion struct {
	Version  string `json:"version"`
	Revision string `json:"revision"`
}

type jaegerResponseVersion struct {
	Version string `json:"gitVersion"`
}

func tracingVersion() (*ExternalServiceInfo, error) {
	tracingConfig := config.Get().ExternalServices.Tracing

	if !tracingConfig.Enabled {
		return nil, nil
	}

	product := ExternalServiceInfo{}
	product.Name = string(tracingConfig.Provider)
	product.Url = tracingConfig.URL

	if product.Url != "" {
		// try to determine version by querying
		if tracingConfig.Provider == config.JaegerProvider {
			body, statusCode, _, err := httputil.HttpGet(product.Url, nil, 10*time.Second, nil, nil)
			if err != nil || statusCode > 399 {
				log.Infof("jaeger version check failed: url=[%v], code=[%v]", product.Url, statusCode)
			} else {
				// Jaeger does not provide api to get version, so it is obtained from js function inside html main page
				// const JAEGER_VERSION = {"gitCommit: xxx, gitVersion: yyy, buildDate: zzz"}
				bodyStr := string(body)
				jaegerVersionConst := "const JAEGER_VERSION = "
				jsonStartIndex := strings.Index(bodyStr, jaegerVersionConst) + len(jaegerVersionConst)
				jsonEndIndex := jsonStartIndex + strings.Index(bodyStr[jsonStartIndex:], ";") //version json ends with ;
				jaegerVersion := bodyStr[jsonStartIndex:jsonEndIndex]

				jaegerV := new(jaegerResponseVersion)
				err = json.Unmarshal([]byte(jaegerVersion), &jaegerV)
				if err == nil {
					product.Version = jaegerV.Version
				}
			}
		}
		// TODO determine version for Tempo
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

func grafanaVersion() (*ExternalServiceInfo, error) {
	product := ExternalServiceInfo{}
	product.Name = "Grafana"
	product.Url = DiscoverGrafana()
	if product.Url != "" {
		// try to determine version by querying
		url := fmt.Sprintf("%s/api/frontend/settings", product.Url)
		body, statusCode, _, err := httputil.HttpGet(url, nil, 10*time.Second, nil, nil)
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

func prometheusVersion() (*ExternalServiceInfo, error) {
	product := ExternalServiceInfo{}
	prometheusV := new(p8sResponseVersion)
	cfg := config.Get().ExternalServices.Prometheus

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		token, _, err := kubernetes.GetKialiTokenForHomeCluster()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
			return nil, err
		}
		auth.Token = token
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

func getKubernetesVersion() []externalService {
	k8sVersions := []externalService{}

	// Use the Kiali Service Account client to get the Kubernetes version
	// since the status endpoint does not have a user token.
	cf, err := kubernetes.GetClientFactory()
	if err != nil {
		return append(k8sVersions, func() (*ExternalServiceInfo, error) { return nil, err })
	}

	// Loop through all SA clients to get Kubernetes versions of all clusters
	for clusterName, saClient := range cf.GetSAClients() {
		serverVersion, err := saClient.GetServerVersion()

		if err != nil {
			k8sVersions = append(k8sVersions, func() (*ExternalServiceInfo, error) { return nil, err })
		} else {
			k8sVersions = append(k8sVersions, func() (*ExternalServiceInfo, error) {
				return &ExternalServiceInfo{
					Name:    fmt.Sprintf("%s-%s", "Kubernetes", clusterName),
					Version: serverVersion.GitVersion,
				}, nil
			})
		}
	}

	return k8sVersions
}
