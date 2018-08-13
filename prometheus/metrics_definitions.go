package prometheus

type kialiMetric struct {
	name           string
	istioName      string
	isHisto        bool
	useErrorLabels bool
}

var (
	kialiMetrics = []kialiMetric{
		kialiMetric{
			name:      "request_count",
			istioName: "istio_requests_total",
			isHisto:   false},
		kialiMetric{
			name:           "request_error_count",
			istioName:      "istio_requests_total",
			isHisto:        false,
			useErrorLabels: true},
		kialiMetric{
			name:      "request_size",
			istioName: "istio_request_bytes",
			isHisto:   true},
		kialiMetric{
			name:      "request_duration",
			istioName: "istio_request_duration_seconds",
			isHisto:   true},
		kialiMetric{
			name:      "response_size",
			istioName: "istio_response_bytes",
			isHisto:   true},
		kialiMetric{
			name:      "tcp_sent",
			istioName: "istio_tcp_sent_bytes_total",
			isHisto:   false},
		kialiMetric{
			name:      "tcp_received",
			istioName: "istio_tcp_received_bytes_total",
			isHisto:   false},
	}
)

func (in *kialiMetric) labelsToUse(labels, labelsError string) string {
	if in.useErrorLabels {
		return labelsError
	}
	return labels
}
