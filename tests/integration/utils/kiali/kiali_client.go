package kiali

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/log"
	mesh_config_common "github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/tracing/jaeger/model"
)

type KialiClient struct {
	kialiURL     string
	kialiToken   string
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

type MetricJson struct {
	Labels     map[string]string `json:"labels"`
	Datapoints []interface{}     `json:"datapoints"`
	Stat       string            `json:"stat,omitempty"`
	Name       string            `json:"name"`
}

// MetricsJsonMap contains map to namespace and MetricsJson
type MetricsJsonMap map[string]*MetricsJson

// MetricsJson contains all simple metrics and histograms data for standard timeseries queries
type MetricsJson struct {
	GrpcReceived          []MetricJson `json:"grpc_received,omitempty"`
	GrpcSent              []MetricJson `json:"grpc_sent,omitempty"`
	RequestCount          []MetricJson `json:"request_count,omitempty"`
	RequestErrorCount     []MetricJson `json:"request_error_count,omitempty"`
	RequestDurationMillis []MetricJson `json:"request_duration_millis,omitempty"`
	RequestThroughput     []MetricJson `json:"request_throughput,omitempty"`
	ResponseThroughput    []MetricJson `json:"response_throughput,omitempty"`
	RequestSize           []MetricJson `json:"request_size,omitempty"`
	ResponseSize          []MetricJson `json:"response_size,omitempty"`
	TcpReceived           []MetricJson `json:"tcp_received,omitempty"`
	TcpSent               []MetricJson `json:"tcp_sent,omitempty"`
	TcpOpened             []MetricJson `json:"tcp_opened,omitempty"`
	TcpClosed             []MetricJson `json:"tcp_closed,omitempty"`
}

var client = *NewKialiClient()

const (
	BOOKINFO        = "bookinfo"
	ASSETS          = "tests/integration/assets"
	TIMEOUT         = 10 * time.Second
	TIMEOUT_MEDIUM  = 20 * time.Second
	TIMEOUT_TRACING = 60 * time.Second
)

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
		}
	} else {
		log.Fatalf("Unable to check Kiali auth strategy, Err: %s", err)
		return
	}
	return
}

func (c *KialiClient) KialiAuthStrategy() (string, error) {
	body, _, _, err := httpGETWithRetry(c.kialiURL+"/api/auth/info", c.GetAuth(), TIMEOUT, nil, nil)
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
	_, code, _, err := httpGETWithRetry(client.kialiURL+"/api/istio/status", client.GetAuth(), TIMEOUT, nil, nil)
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

func KialiConfig() (*handlers.PublicConfig, int, error) {
	url := fmt.Sprintf("%s/api/config", client.kialiURL)
	response := new(handlers.PublicConfig)

	code, err := getRequestAndUnmarshalInto(url, response)
	if err == nil {
		return response, code, nil
	} else {
		return nil, code, err
	}
}

func TracingConfig() (*models.TracingInfo, int, error) {
	url := fmt.Sprintf("%s/api/tracing", client.kialiURL)
	response := new(models.TracingInfo)

	code, err := getRequestAndUnmarshalInto(url, response)
	if err == nil {
		return response, code, nil
	} else {
		return nil, code, err
	}
}

func Namespaces() (*models.Namespaces, int, error) {
	url := fmt.Sprintf("%s/api/namespaces", client.kialiURL)
	response := new(models.Namespaces)

	code, err := getRequestAndUnmarshalInto(url, response)
	if err == nil {
		return response, code, nil
	} else {
		return nil, code, err
	}
}

func NamespaceWorkloadHealth(namespace string, params map[string]string) (*models.NamespaceWorkloadHealth, int, error) {
	params["type"] = "workload"
	url := fmt.Sprintf("%s/api/clusters/health?namespaces=%s&%s", client.kialiURL, namespace, ParamsAsString(params))
	health := new(models.ClustersNamespaceHealth)

	code, err := getRequestAndUnmarshalInto(url, health)
	if err == nil {
		return health.WorkloadHealth[namespace], code, nil
	} else {
		return nil, code, err
	}
}

func NamespaceAppHealth(namespace string, params map[string]string) (*models.NamespaceAppHealth, int, error) {
	params["type"] = "app"
	url := fmt.Sprintf("%s/api/clusters/health?namespaces=%s&%s", client.kialiURL, namespace, ParamsAsString(params))
	health := new(models.ClustersNamespaceHealth)

	code, err := getRequestAndUnmarshalInto(url, health)
	if err == nil {
		return health.AppHealth[namespace], code, nil
	} else {
		return nil, code, err
	}
}

func NamespaceServiceHealth(namespace string, params map[string]string) (*models.NamespaceServiceHealth, int, error) {
	params["type"] = "service"
	url := fmt.Sprintf("%s/api/clusters/health?namespaces=%s&%s", client.kialiURL, namespace, ParamsAsString(params))
	health := new(models.ClustersNamespaceHealth)

	code, err := getRequestAndUnmarshalInto(url, health)
	if err == nil {
		return health.ServiceHealth[namespace], code, nil
	} else {
		return nil, code, err
	}
}

func ApplicationsList(namespace string) (*models.ClusterApps, error) {
	url := fmt.Sprintf("%s/api/clusters/apps?namespaces=%s", client.kialiURL, namespace)
	appList := new(models.ClusterApps)

	_, err := getRequestAndUnmarshalInto(url, appList)
	if err == nil {
		return appList, nil
	} else {
		return nil, err
	}
}

func ApplicationDetails(name, namespace string) (*models.App, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/apps/%s?health=true", client.kialiURL, namespace, name)
	app := new(models.App)

	code, err := getRequestAndUnmarshalInto(url, app)
	if err == nil {
		return app, code, nil
	} else {
		return nil, code, err
	}
}

func ServicesList(namespace string) (*ServiceListJson, error) {
	url := fmt.Sprintf("%s/api/clusters/services?namespaces=%s", client.kialiURL, namespace)
	serviceList := new(ServiceListJson)
	_, err := getRequestAndUnmarshalInto(url, serviceList)
	if err == nil {
		return serviceList, nil
	} else {
		return nil, err
	}
}

func ServiceDetails(name, namespace string) (*ServiceDetailsJson, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/services/%s?validate=true&health=true", client.kialiURL, namespace, name)
	service := new(ServiceDetailsJson)

	code, err := getRequestAndUnmarshalInto(url, service)
	if err == nil {
		return service, code, nil
	} else {
		return nil, code, err
	}
}

func Traces(objectType, name, namespace string) (*model.TracingResponse, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/%s/%s/traces?startMicros=%d&tags=&limit=100", client.kialiURL, namespace, objectType, name, TimeSince())
	traces := new(model.TracingResponse)

	code, err := getRequestAndUnmarshalIntoWithCustomTimeout(url, TIMEOUT_TRACING, traces)
	if err == nil {
		return traces, code, nil
	} else {
		return nil, code, err
	}
}

func Spans(objectType, name, namespace string) ([]model.TracingSpan, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/%s/%s/spans?startMicros=%d&tags=&limit=100", client.kialiURL, namespace, objectType, name, TimeSince())
	spans := new([]model.TracingSpan)

	code, err := getRequestAndUnmarshalIntoWithCustomTimeout(url, TIMEOUT_TRACING, spans)
	if err == nil {
		return *spans, code, nil
	} else {
		return nil, code, err
	}
}

func WorkloadsList(namespace string) (*WorkloadListJson, error) {
	url := fmt.Sprintf("%s/api/clusters/workloads?namespaces=%s", client.kialiURL, namespace)
	wlList := new(WorkloadListJson)
	_, err := getRequestAndUnmarshalInto(url, wlList)
	if err != nil {
		return nil, err
	}
	return wlList, nil
}

func WorkloadDetails(name, namespace string) (*WorkloadJson, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/workloads/%s?validate=true&health=true", client.kialiURL, namespace, name)
	workload := new(WorkloadJson)

	code, err := getRequestAndUnmarshalInto(url, workload)
	if err == nil {
		return workload, code, nil
	} else {
		return nil, code, err
	}
}

func IstioConfigs() (*models.IstioConfigList, error) {
	url := fmt.Sprintf("%s/api/istio/config?validate=true", client.kialiURL)
	configList := new(models.IstioConfigList)

	_, err := getRequestAndUnmarshalInto(url, configList)
	if err == nil {
		return configList, nil
	} else {
		return nil, err
	}
}

func IstioConfigsList(namespace string) (*models.IstioConfigList, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/istio?validate=true", client.kialiURL, namespace)
	configList := new(models.IstioConfigList)

	_, err := getRequestAndUnmarshalInto(url, configList)
	if err == nil {
		return configList, nil
	} else {
		return nil, err
	}
}

func IstioConfigDetails(namespace, name string, configType schema.GroupVersionKind) (*models.IstioConfigDetails, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/istio/%s/%s/%s/%s?validate=true", client.kialiURL, namespace, configType.Group, configType.Version, configType.Kind, name)
	config := new(models.IstioConfigDetails)

	code, err := getRequestAndUnmarshalInto(url, config)
	if err == nil {
		return config, code, nil
	} else {
		return nil, code, err
	}
}

func IstioConfigPermissions(namespace string) (*models.IstioConfigPermissions, error) {
	url := fmt.Sprintf("%s/api/istio/permissions?namespaces=%s", client.kialiURL, namespace)
	perms := new(models.IstioConfigPermissions)

	_, err := getRequestAndUnmarshalInto(url, perms)
	if err == nil {
		return perms, nil
	} else {
		return nil, err
	}
}

func IstioPermissions() (*models.IstioConfigPermissions, int, error) {
	url := fmt.Sprintf("%s/api/istio/permissions", client.kialiURL)
	perms := new(models.IstioConfigPermissions)

	code, err := getRequestAndUnmarshalInto(url, perms)
	if err == nil {
		return perms, code, nil
	} else {
		return nil, code, err
	}
}

func Graph(params map[string]string) (*common.Config, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/graph?%s", client.kialiURL, ParamsAsString(params))
	graph := new(common.Config)

	code, err := getRequestAndUnmarshalInto(url, graph)
	if err == nil {
		return graph, code, nil
	} else {
		return nil, code, err
	}
}

func ObjectGraph(objectType, graphType, name, namespace string) (*common.Config, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/%s/%s/graph?duration=60s&graphType=%s", client.kialiURL, namespace, objectType, name, graphType)
	graph := new(common.Config)

	code, err := getRequestAndUnmarshalInto(url, graph)
	if err == nil {
		return graph, code, nil
	} else {
		return nil, code, err
	}
}

func AppVersionGraph(graphType, name, version, namespace string) (*common.Config, int, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/applications/%s/versions/%s/graph?duration=60s&graphType=%s", client.kialiURL, namespace, name, version, graphType)
	graph := new(common.Config)

	code, err := getRequestAndUnmarshalInto(url, graph)
	if err == nil {
		return graph, code, nil
	} else {
		return nil, code, err
	}
}

func ClustersMetrics(namespace string, params map[string]string) (*MetricsJsonMap, error) {
	url := fmt.Sprintf("%s/api/clusters/metrics?%s&namespaces=%s", client.kialiURL, ParamsAsString(params), namespace)
	metrics := new(MetricsJsonMap)

	_, err := getRequestAndUnmarshalInto(url, metrics)
	if err == nil {
		return metrics, nil
	} else {
		return nil, err
	}
}

func NamespaceMetrics(namespace string, params map[string]string) (*MetricsJson, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/metrics?%s", client.kialiURL, namespace, ParamsAsString(params))
	metrics := new(MetricsJson)

	_, err := getRequestAndUnmarshalInto(url, metrics)
	if err == nil {
		return metrics, nil
	} else {
		return nil, err
	}
}

func ObjectMetrics(namespace, service, objectType string, params map[string]string) (*MetricsJson, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/%s/%s/metrics?%s", client.kialiURL, namespace, objectType, service, ParamsAsString(params))
	metrics := new(MetricsJson)

	_, err := getRequestAndUnmarshalInto(url, metrics)
	if err == nil {
		return metrics, nil
	} else {
		return nil, err
	}
}

func ObjectDashboard(namespace, name, objectType string) (*models.MonitoringDashboard, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/%s/%s/dashboard", client.kialiURL, namespace, objectType, name)
	body, _, _, err := httpGETWithRetry(url, client.GetAuth(), TIMEOUT, nil, nil)
	if err == nil {
		response := new(models.MonitoringDashboard)
		// tests are checking only common response for different object types, ignore the error
		_ = json.Unmarshal(body, &response)
		return response, nil
	} else {
		return nil, err
	}
}

func MeshTls() (*models.MTLSStatus, int, error) {
	url := fmt.Sprintf("%s/api/mesh/tls", client.kialiURL)
	status := new(models.MTLSStatus)

	code, err := getRequestAndUnmarshalInto(url, status)
	if err == nil {
		return status, code, nil
	} else {
		return nil, code, err
	}
}

func ClustersTls(namespace string) (*[]models.MTLSStatus, int, error) {
	url := fmt.Sprintf("%s/api/clusters/tls?namespaces=%s", client.kialiURL, namespace)
	status := new([]models.MTLSStatus)

	code, err := getRequestAndUnmarshalInto(url, status)
	if err == nil {
		return status, code, nil
	} else {
		return nil, code, err
	}
}

func Tracing() (*models.TracingInfo, int, error) {
	url := fmt.Sprintf("%s/api/tracing", client.kialiURL)
	status := new(models.TracingInfo)

	code, err := getRequestAndUnmarshalInto(url, status)
	if err == nil {
		return status, code, err
	} else {
		return nil, code, err
	}
}

func Grafana() (*models.GrafanaInfo, int, error) {
	url := fmt.Sprintf("%s/api/grafana", client.kialiURL)
	status := new(models.GrafanaInfo)

	code, err := getRequestAndUnmarshalInto(url, status)
	if err == nil {
		return status, code, err
	} else {
		return nil, code, err
	}
}

func getRequestAndUnmarshalInto[T any](url string, response *T) (int, error) {
	return getRequestAndUnmarshalIntoWithCustomTimeout(url, TIMEOUT, response)
}

func getRequestAndUnmarshalIntoWithCustomTimeout[T any](url string, timeout time.Duration, response *T) (int, error) {
	body, code, _, err := httpGETWithRetry(url, client.GetAuth(), timeout, nil, nil)
	if err != nil {
		return code, err
	}

	if code != http.StatusOK {
		return code, fmt.Errorf("non 200 response code: %d from url: %s. Body: %s", code, url, body)
	}

	err = json.Unmarshal(body, response)
	if err != nil {
		return code, fmt.Errorf("unable to unmarshal body into response: %T. Body: %s", response, body)
	}

	return code, nil
}

func MeshGraph() (*mesh_config_common.Config, error) {
	url := fmt.Sprintf("%s/api/mesh/graph", client.kialiURL)
	meshGraph := new(mesh_config_common.Config)
	_, err := getRequestAndUnmarshalInto(url, meshGraph)
	if err != nil {
		return nil, err
	}

	return meshGraph, nil
}

func IstioApiEnabled() (bool, error) {
	url := fmt.Sprintf("%s/api/status", client.kialiURL)
	status := new(status.StatusInfo)

	_, err := getRequestAndUnmarshalIntoWithCustomTimeout(url, TIMEOUT_MEDIUM, status)
	if err == nil {
		return status.IstioEnvironment.IstioAPIEnabled, nil
	} else {
		return false, err
	}
}

func FirstPodName(name, namespace string) (string, error) {
	workload, _, err := WorkloadDetails(name, namespace)
	if err == nil {
		if len(workload.Pods) > 0 {
			return workload.Pods[0].Name, nil
		} else {
			return "", nil
		}
	} else {
		return "", err
	}
}

func PodLogs(name, namespace string, params map[string]string) (*business.PodLog, error) {
	url := fmt.Sprintf("%s/api/namespaces/%s/pods/%s/logs?sinceTime=%d&%s", client.kialiURL, namespace, name, TimeSinceSeconds(), ParamsAsString(params))
	body, _, _, err := httpGETWithRetry(url, client.GetAuth(), TIMEOUT, nil, nil)
	if err == nil {
		logs := new(business.PodLog)
		err = json.Unmarshal(body, &logs)
		if err == nil {
			return logs, nil
		} else {
			return nil, err
		}
	} else {
		return nil, err
	}
}

func TimeSince() int64 {
	return time.Now().UTC().Add(-time.Minute * time.Duration(10)).UnixMicro()
}

func TimeSinceSeconds() int64 {
	return time.Now().UTC().Add(-time.Minute * time.Duration(10)).Unix()
}

func ParamsAsString(params map[string]string) string {
	result := ""
	for k, v := range params {
		result += k + "=" + v + "&"
	}
	return result
}
