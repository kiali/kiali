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
			isHisto:   true}}
)

func (in *kialiMetric) labelsToUse(labelsIn, labelsOut, labelsErrorIn, labelsErrorOut string) (string, string) {
	if in.useErrorLabels {
		return labelsErrorIn, labelsErrorOut
	}
	return labelsIn, labelsOut
}
