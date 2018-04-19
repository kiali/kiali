package models

// Health contains aggregated health from various sources, for a given service
type Health struct {
	Envoy              EnvoyHealth        `json:"envoy"`
	DeploymentStatuses []DeploymentStatus `json:"deploymentStatuses"`
	Requests           RequestHealth      `json:"requests"`
	DeploymentsFetched bool               `json:"-"`
}

// EnvoyHealth is the number of healthy versus total membership (ie. replicas) inside envoy cluster (ie. service)
type EnvoyHealth struct {
	Healthy int  `json:"healthy"`
	Total   int  `json:"total"`
	Fetched bool `json:"-"`
}

// DeploymentStatus gives the available / total replicas in a deployment of a pod
type DeploymentStatus struct {
	Name              string `json:"name"`
	Replicas          int32  `json:"replicas"`
	AvailableReplicas int32  `json:"available"`
}

// RequestHealth holds several stats about recent request errors
type RequestHealth struct {
	RequestCount      float64 `json:"requestCount"`
	RequestErrorCount float64 `json:"requestErrorCount"`
	Fetched           bool    `json:"-"`
}

// FillDeploymentStatusesIfMissing sets DeploymentStatuses if necessary
func (in *Health) FillDeploymentStatusesIfMissing(supplier func() []DeploymentStatus) {
	if !in.DeploymentsFetched {
		in.DeploymentStatuses = supplier()
		in.DeploymentsFetched = true
	}
}

// FillIfMissing sets EnvoyHealth if necessary. Supplier must return (healthy, total)
func (in *EnvoyHealth) FillIfMissing(supplier func() (int, int)) {
	if !in.Fetched {
		h, t := supplier()
		in.Healthy = h
		in.Total = t
		in.Fetched = true
	}
}

// FillIfMissing sets RequestHealth if necessary. Supplier must return (errors, total)
func (in *RequestHealth) FillIfMissing(supplier func() (float64, float64)) {
	if !in.Fetched {
		e, t := supplier()
		in.RequestErrorCount = e
		in.RequestCount = t
		in.Fetched = true
	}
}
