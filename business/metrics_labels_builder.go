package business

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
)

const (
	destination                = "destination"
	source                     = "source"
	regexGrpcResponseStatusErr = "^[1-9]$|^1[0-6]$"
	regexResponseCodeErr       = "^0$|^[4-5]\\\\d\\\\d$"
)

type MetricsLabelsBuilder struct {
	conf     *config.Config
	labelsKV []string
	peerSide string
	protocol string
	side     string
}

func NewMetricsLabelsBuilder(direction string, conf *config.Config) *MetricsLabelsBuilder {
	side := destination
	peerSide := source
	if direction == "outbound" {
		side = source
		peerSide = destination
	}
	return &MetricsLabelsBuilder{
		conf:     conf,
		peerSide: peerSide,
		side:     side,
	}
}

func (lb *MetricsLabelsBuilder) Add(key, value string) *MetricsLabelsBuilder {
	lb.labelsKV = append(lb.labelsKV, fmt.Sprintf(`%s="%s"`, key, value))
	return lb
}

func (lb *MetricsLabelsBuilder) AddOp(key, value, op string) *MetricsLabelsBuilder {
	lb.labelsKV = append(lb.labelsKV, fmt.Sprintf(`%s%s"%s"`, key, op, value))
	return lb
}

func (lb *MetricsLabelsBuilder) addSided(partialKey, value, side string) *MetricsLabelsBuilder {
	lb.labelsKV = append(lb.labelsKV, fmt.Sprintf(`%s_%s="%s"`, side, partialKey, value))
	return lb
}

func (lb *MetricsLabelsBuilder) Reporter(name string, includeAmbient bool) *MetricsLabelsBuilder {
	if includeAmbient {
		return lb.AddOp("reporter", fmt.Sprintf("%s|%s", name, "waypoint"), "=~")
	}
	return lb.Add("reporter", name)
}

func (lb *MetricsLabelsBuilder) SelfReporter() *MetricsLabelsBuilder {
	return lb.Add("reporter", lb.side)
}

func (lb *MetricsLabelsBuilder) Service(name, namespace string) *MetricsLabelsBuilder {
	if lb.side == destination {
		lb.Add("destination_service_name", name)
		if namespace != "" {
			lb.Add("destination_service_namespace", namespace)
		}
	}
	return lb
}

func (lb *MetricsLabelsBuilder) Namespace(namespace string) *MetricsLabelsBuilder {
	return lb.addSided("workload_namespace", namespace, lb.side)
}

func (lb *MetricsLabelsBuilder) Workload(name, namespace string) *MetricsLabelsBuilder {
	if namespace != "" {
		lb.addSided("workload_namespace", namespace, lb.side)
	}
	return lb.addSided("workload", name, lb.side)
}

func (lb *MetricsLabelsBuilder) Cluster(cluster string) *MetricsLabelsBuilder {
	return lb.addSided("cluster", cluster, lb.side)
}

func (lb *MetricsLabelsBuilder) App(name, namespace string) *MetricsLabelsBuilder {
	if namespace != "" {
		// workload_namespace works for app as well
		lb.addSided("workload_namespace", namespace, lb.side)
	}
	return lb.addSided("canonical_service", name, lb.side)
}

func (lb *MetricsLabelsBuilder) PeerService(name, namespace string) *MetricsLabelsBuilder {
	if lb.peerSide == destination {
		lb.Add("destination_service_name", name)
		if namespace != "" {
			lb.Add("destination_service_namespace", namespace)
		}
	}
	return lb
}

func (lb *MetricsLabelsBuilder) PeerNamespace(namespace string) *MetricsLabelsBuilder {
	return lb.addSided("workload_namespace", namespace, lb.peerSide)
}

func (lb *MetricsLabelsBuilder) PeerWorkload(name, namespace string) *MetricsLabelsBuilder {
	if namespace != "" {
		lb.addSided("workload_namespace", namespace, lb.peerSide)
	}
	return lb.addSided("workload", name, lb.peerSide)
}

func (lb *MetricsLabelsBuilder) PeerApp(name, namespace string) *MetricsLabelsBuilder {
	if namespace != "" {
		// workload_namespace works for app as well
		lb.addSided("workload_namespace", namespace, lb.peerSide)
	}
	return lb.addSided("canonical_service", name, lb.peerSide)
}

func (lb *MetricsLabelsBuilder) Protocol(name string) *MetricsLabelsBuilder {
	lb.protocol = strings.ToLower(name)
	return lb.Add("request_protocol", name)
}

func (lb *MetricsLabelsBuilder) Aggregate(key, value string) *MetricsLabelsBuilder {
	return lb.Add(key, value)
}

// QueryScope adds scope labels, if configured
func (lb *MetricsLabelsBuilder) QueryScope() *MetricsLabelsBuilder {
	scope := lb.conf.ExternalServices.Prometheus.QueryScope

	for labelName, labelValue := range scope {
		lb.Add(prometheus.SanitizeLabelName(labelName), labelValue)
	}
	return lb
}

func (lb *MetricsLabelsBuilder) Build() string {
	return "{" + strings.Join(lb.labelsKV, ",") + "}"
}

func (lb *MetricsLabelsBuilder) BuildForErrors() []string {
	errors := []string{}

	// both http and grpc requests can suffer from no response (response_code=0) or an http error
	// (response_code=4xx,5xx), and so we always perform a query against response_code:
	httpLabels := append(lb.labelsKV, fmt.Sprintf(`response_code=~"%s"`, regexResponseCodeErr))
	errors = append(errors, "{"+strings.Join(httpLabels, ",")+"}")

	// if necessary also look for grpc errors. note that the grpc test intentionally avoids
	// `grpc_response_status!="0"`. We need to be backward compatible and handle the case where
	// grpc_response_status does not exist, or if it is simply unset. In Prometheus, negative tests on a
	// non-existent label match everything, but positive tests match nothing. So, we stay positive.
	// furthermore, make sure we only count grpc errors with successful http status.
	if lb.protocol != "http" {
		grpcLabels := append(lb.labelsKV, fmt.Sprintf(`grpc_response_status=~"%s",response_code!~"%s"`, regexGrpcResponseStatusErr, regexResponseCodeErr))
		errors = append(errors, ("{" + strings.Join(grpcLabels, ",") + "}"))
	}
	return errors
}
