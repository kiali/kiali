package models

// ServiceLatency represents a single service's latency measurement
type ServiceLatency struct {
	Cluster      string       `json:"cluster"`
	HealthStatus HealthStatus `json:"healthStatus,omitempty"`
	Latency      float64      `json:"latency"` // in milliseconds
	Namespace    string       `json:"namespace"`
	ServiceName  string       `json:"serviceName"`
}

func (s *ServiceLatency) GetCluster() string             { return s.Cluster }
func (s *ServiceLatency) GetNamespace() string           { return s.Namespace }
func (s *ServiceLatency) GetServiceName() string         { return s.ServiceName }
func (s *ServiceLatency) SetHealthStatus(h HealthStatus) { s.HealthStatus = h }

// ServiceLatencyResponse contains the sorted list of service latencies
type ServiceLatencyResponse struct {
	Services []ServiceLatency `json:"services"`
}

// ServiceRequests represents a single service's request statistics
type ServiceRequests struct {
	Cluster      string       `json:"cluster"`
	ErrorRate    float64      `json:"errorRate"` // error rate as a decimal (0.0 to 1.0)
	HealthStatus HealthStatus `json:"healthStatus,omitempty"`
	Namespace    string       `json:"namespace"`
	RequestRate  float64      `json:"requestRate"` // requests per second
	ServiceName  string       `json:"serviceName"`
}

// ServiceRatesResponse contains the sorted list of service request statistics
type ServiceRatesResponse struct {
	Services []ServiceRequests `json:"services"`
}

// ServiceTraffic represents a single service's TCP traffic rate.
// TcpRate is bytes per second, and is computed as received+sent.
type ServiceTraffic struct {
	Cluster      string       `json:"cluster"`
	HealthStatus HealthStatus `json:"healthStatus,omitempty"`
	Namespace    string       `json:"namespace"`
	ServiceName  string       `json:"serviceName"`
	TcpRate      float64      `json:"tcpRate"` // bytes per second
}

func (s *ServiceTraffic) GetCluster() string             { return s.Cluster }
func (s *ServiceTraffic) GetNamespace() string           { return s.Namespace }
func (s *ServiceTraffic) GetServiceName() string         { return s.ServiceName }
func (s *ServiceTraffic) SetHealthStatus(h HealthStatus) { s.HealthStatus = h }

// ServiceTrafficResponse contains the sorted list of service TCP traffic rates
type ServiceTrafficResponse struct {
	HasWaypoints bool             `json:"hasWaypoints"`
	Services     []ServiceTraffic `json:"services"`
}

// AppRequests represents a single app's request statistics from the health cache
type AppRequests struct {
	AppName        string       `json:"appName"`
	Cluster        string       `json:"cluster"`
	HealthStatus   HealthStatus `json:"healthStatus,omitempty"`
	Namespace      string       `json:"namespace"`
	RequestRateIn  float64      `json:"requestRateIn"`  // inbound requests per second
	RequestRateOut float64      `json:"requestRateOut"` // outbound requests per second
}

// AppRatesResponse contains the list of app request statistics
type AppRatesResponse struct {
	Apps []AppRequests `json:"apps"`
}
