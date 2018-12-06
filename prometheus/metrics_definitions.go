package prometheus

type IstioMetric struct {
	KialiName      string
	IstioName      string
	IsHisto        bool
	UseErrorLabels bool
}

var IstioMetrics = []IstioMetric{
	IstioMetric{
		KialiName: "request_count",
		IstioName: "istio_requests_total",
		IsHisto:   false,
	},
	IstioMetric{
		KialiName:      "request_error_count",
		IstioName:      "istio_requests_total",
		IsHisto:        false,
		UseErrorLabels: true,
	},
	IstioMetric{
		KialiName: "request_duration",
		IstioName: "istio_request_duration_seconds",
		IsHisto:   true,
	},
	IstioMetric{
		KialiName: "request_size",
		IstioName: "istio_request_bytes",
		IsHisto:   true,
	},
	IstioMetric{
		KialiName: "response_size",
		IstioName: "istio_response_bytes",
		IsHisto:   true,
	},
	IstioMetric{
		KialiName: "tcp_received",
		IstioName: "istio_tcp_received_bytes_total",
		IsHisto:   false,
	},
	IstioMetric{
		KialiName: "tcp_sent",
		IstioName: "istio_tcp_sent_bytes_total",
		IsHisto:   false,
	},
}

func (in *IstioMetric) labelsToUse(labels, labelsError string) string {
	if in.UseErrorLabels {
		return labelsError
	}
	return labels
}
