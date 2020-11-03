package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type Iter8Info struct {
	Enabled                bool   `json:"enabled"`
	SupportedVersion       bool   `json:"supportedVersion"`
	ControllerImageVersion string `json:"controllerImgVersion"`
	AnalyticsImageVersion  string `json:"analyticsImgVersion"`
}

type Iter8CandidateStatus struct {
	Name                string                                `json:"name"`
	Version             string                                `json:"version"`
	Weight              int32                                 `json:"weight"`
	WinProbability      float32                               `json:"winProbability"`
	Request_Count       int32                                 `json:"requestCount"`
	CriteriaAssessments []kubernetes.Iter8CriterionAssessment `json:"criterionAssessment"`
}

// For Displaying Iter8 Experiment Details
type Iter8ExperimentItem struct {
	Name                   string                     `json:"name"`
	Phase                  string                     `json:"phase"`
	Status                 string                     `json:"status"`
	Baseline               Iter8CandidateStatus       `json:"baseline"`
	Candidates             []Iter8CandidateStatus     `json:"candidates"`
	Namespace              string                     `json:"namespace"`
	InitTime               string                     `json:"initTime"`
	StartTime              string                     `json:"startTime"`
	EndTime                string                     `json:"endTime"`
	TargetService          string                     `json:"targetService"`
	TargetServiceNamespace string                     `json:"targetServiceNamespace"`
	Winner                 Iter8SuccessCrideriaStatus `json:"winner"`
	Kind                   string                     `json:"kind"`
	ExperimentType         string                     `json:"experimentKind"`
}

// For Displaying Iter8 Experiment Tabs
type Iter8ExperimentDetail struct {
	ExperimentItem  Iter8ExperimentItem        `json:"experimentItem"`
	CriteriaDetails []Iter8CriteriaDetail      `json:"criterias"`
	Networking      kubernetes.Iter8Networking `json:"networking"`
	TrafficControl  Iter8TrafficControl        `json:"trafficControl"`
	Permissions     ResourcePermissions        `json:"permissions"`
	ExperimentType  string                     `json:"experimentType"`
	Duration        kubernetes.Iter8Duration   `json:"duration"`
	Action          string                     `json:"action"`
}

type Iter8CriteriaDetail struct {
	Name     string        `json:"name"`
	Criteria Iter8Criteria `json:"criteria"`
	Metric   Iter8Metric   `json:"metric"`
}

type Iter8Metric struct {
	Name               string                   `json:"name"`
	Numerator          kubernetes.CounterMetric `json:"numerator" yaml:"numerator"`
	Denominator        kubernetes.CounterMetric `json:"denominator" yaml:"denominator"`
	ZeroToOne          *bool                    `json:"zero_to_one,omitempty" yaml:"zero_to_one,omitempty"`
	PreferredDirection *string                  `json:"preferred_direction,omitempty" yaml:"preferred_direction,omitempty"`
}

type Iter8SuccessCrideriaStatus struct {
	Name        *string  `json:"name,omitempty"`
	WinnerFound *bool    `json:"winning_version_found"`
	Winner      string   `json:"current_best_version,omitempty"`
	Probability *float32 `json:"probability_of_winning_for_best_version,omitempty"`
}

// Spec for Creating Experiment
type Iter8ExperimentSpec struct {
	Name           string                       `json:"name"`
	Namespace      string                       `json:"namespace"`
	Service        string                       `json:"service"`
	APIVersion     string                       `json:"apiversion"`
	Baseline       string                       `json:"baseline"`
	Candidates     []string                     `json:"candidates"`
	TrafficControl Iter8TrafficControl          `json:"trafficControl"`
	Criterias      []Iter8Criteria              `json:"criterias"`
	Hosts          []kubernetes.Iter8Host       `json:"hosts"`
	RoutingID      string                       `json:"routingID"`
	Action         *kubernetes.ExperimentAction `json:"action"`
	TrafficSplit   map[string]int32             `json:"trafficSplit,omitempty"`
	ExperimentKind string                       `json:"experimentKind"`
	ExperimentType string                       `json:"experimentType"`
	Duration       kubernetes.Iter8Duration     `json:"duration"`
	Cleanup        bool                         `json:"cleanup"`
	Metrics        Iter8Metrics                 `json:"metrics"`
}
type Iter8ExperimentAction struct {
	Action       string     `json:"action"`
	TrafficSplit [][]string `json:"trafficSplit,omitempty"`
}

type Iter8TrafficControl struct {
	Strategy      string     `json:"strategy,omitempty"`      // v1.0.0
	OnTermination string     `json:"onTermination,omitempty"` // v1.0.0
	Match         Iter8Match `json:"match,omitempty"`         // v1.0.0
	Percentage    int32      `json:"percentage,omitempty"`    // v1.0.0
	MaxIncrement  int32      `json:"maxIncrement,omitempty"`
}

type Iter8Criteria struct {
	Metric        string  `json:"metric"`
	ToleranceType string  `json:"toleranceType"`
	Tolerance     float32 `json:"tolerance"`
	StopOnFailure bool    `json:"stopOnFailure"`
	IsReward      bool    `json:"isReward"`
}
type Iter8Metrics struct {
	CounterMetrics []kubernetes.CounterMetric `json:"counter_metrics,omitempty"`
	RatioMetrics   []kubernetes.RatioMetric   `json:"ratio_metrics,omitempty"`
}

// Match contains matching criteria for requests
type Iter8Match struct {
	HTTP []HTTPMatchRequest `json:"http,omitempty"`
}

type HTTPMatchRequest struct {
	URI     HTTPMatchRule   `json:"uri,omitempty"`
	Headers []HTTPMatchRule `json:"headers,omitempty"`
}

type HTTPMatchRule struct {
	Key         string `json:"key,omitempty"`
	Match       string `json:"match,omitempty"`
	StringMatch string `json:"stringMatch,omitempty"`
}

type Iter8AnalyticsConfig struct {
	Port       int `yaml:"port,omitempty"`
	Prometheus struct {
		Auth struct {
			CAFile             string `yaml:"ca_file"`
			InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
			Password           string `yaml:"password"`
			Token              string `yaml:"token"`
			Type               string `yaml:"type"`
			UserName           string `yaml:"username"`
		} `yaml:"auth"`
		URL string `yaml:"url"`
	} `yaml:"prometheus"`
}

func (i *Iter8ExperimentSpec) Parse(iter8Object Iter8ExperimentDetail) {
	candidates := make([]string, len(iter8Object.ExperimentItem.Candidates))
	for i, c := range iter8Object.ExperimentItem.Candidates {
		candidates[i] = c.Name
	}
	i.Name = iter8Object.ExperimentItem.Name
	i.Namespace = iter8Object.ExperimentItem.Namespace
	i.Service = iter8Object.ExperimentItem.TargetService
	i.Candidates = candidates
	i.Baseline = iter8Object.ExperimentItem.Baseline.Name
	i.ExperimentKind = iter8Object.ExperimentItem.Kind
	i.TrafficControl = iter8Object.TrafficControl
	i.Criterias = make([]Iter8Criteria, len(iter8Object.CriteriaDetails))
	for k, c := range iter8Object.CriteriaDetails {
		i.Criterias[k] = c.Criteria
	}
	i.Duration = iter8Object.Duration
	i.ExperimentType = iter8Object.ExperimentType
}
func (i *Iter8ExperimentDetail) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()

	type MetricMap map[string]kubernetes.CounterMetric
	counterMetrics := MetricMap{}
	for _, cm := range spec.Metrics.CounterMetrics {
		metricDetail := kubernetes.CounterMetric{
			Name:               cm.Name,
			QueryTemplate:      cm.QueryTemplate,
			PreferredDirection: cm.PreferredDirection,
			Unit:               cm.Unit,
		}
		counterMetrics[cm.Name] = metricDetail
	}

	type RMetricMap map[string]Iter8Metric
	rMetrics := RMetricMap{}
	// ratioMetrics := make([]Iter8Metric, len(spec.Metrics.RatioMetrics))
	for _, m := range spec.Metrics.RatioMetrics {
		metricDetail := Iter8Metric{
			Name:               m.Name,
			Denominator:        counterMetrics[m.Denominator],
			Numerator:          counterMetrics[m.Numerator],
			PreferredDirection: m.PreferredDirection,
		}
		rMetrics[m.Name] = metricDetail
	}

	criterias := make([]Iter8CriteriaDetail, len(spec.Criteria))

	for i, c := range spec.Criteria {
		criteriaDetail := Iter8CriteriaDetail{
			Name: c.Metric,
			Criteria: Iter8Criteria{
				Metric:   c.Metric,
				IsReward: c.IsReward,
			},
			Metric: rMetrics[c.Metric],
		}
		if c.Threshold != nil {
			criteriaDetail.Criteria.Tolerance = c.Threshold.Value
			criteriaDetail.Criteria.ToleranceType = c.Threshold.Type
			criteriaDetail.Criteria.StopOnFailure = c.Threshold.CutoffTrafficOnViolation
		}

		criterias[i] = criteriaDetail
	}

	if spec.Networking != nil {
		hosts := make([]kubernetes.Iter8Host, len(spec.Networking.Hosts))
		for i, h := range spec.Networking.Hosts {
			host := kubernetes.Iter8Host{}
			host.Name = h.Name
			host.Gateway = h.Gateway
			hosts[i] = host
		}

		networking := kubernetes.Iter8Networking{
			ID:    spec.Networking.ID,
			Hosts: hosts,
		}
		i.Networking = networking
	}

	trafficControl := Iter8TrafficControl{
		Strategy:      spec.TrafficControl.Strategy,
		MaxIncrement:  spec.TrafficControl.MaxIncrement,
		Percentage:    spec.TrafficControl.Percentage,
		OnTermination: spec.TrafficControl.OnTermination,
	}
	if spec.TrafficControl.Match.HTTP != nil {
		ptr := make([]HTTPMatchRequest, len(spec.TrafficControl.Match.HTTP))
		for i, m := range spec.TrafficControl.Match.HTTP {
			nm := HTTPMatchRequest{}
			nm.parse(m)
			ptr[i] = nm
		}
		trafficControl.Match.HTTP = ptr
	}

	targetServiceNamespace := spec.Service.Namespace
	if targetServiceNamespace == "" {
		targetServiceNamespace = iter8Object.GetObjectMeta().Namespace
	}

	candidateStatus := make([]Iter8CandidateStatus, len(status.Assestment.Candidates))
	for i, c := range status.Assestment.Candidates {
		cs := Iter8CandidateStatus{
			Name:                c.Name,
			Weight:              c.Weight,
			WinProbability:      c.WinProbability,
			Request_Count:       c.RequestCount,
			CriteriaAssessments: c.CriterionAssessments,
		}
		candidateStatus[i] = cs
	}

	kind := spec.Service.Kind
	if kind == "" {
		kind = "Deployment"
	}
	endTime := ""
	if (status.EndTimestamp != meta_v1.Time{}) {
		endTime = formatTime(status.EndTimestamp.Time)
	}
	i.ExperimentItem = Iter8ExperimentItem{
		Name:   iter8Object.GetObjectMeta().Name,
		Phase:  status.Phase,
		Status: status.Message,
		Baseline: Iter8CandidateStatus{
			Name:                status.Assestment.Baseline.Name,
			Weight:              status.Assestment.Baseline.Weight,
			CriteriaAssessments: status.Assestment.Baseline.CriterionAssessments,
			WinProbability:      status.Assestment.Baseline.WinProbability,
			Request_Count:       status.Assestment.Baseline.RequestCount,
		},
		Candidates:             candidateStatus,
		InitTime:               formatTime(status.InitTimeStamp.Time),
		StartTime:              formatTime(status.StartTimeStamp.Time),
		EndTime:                endTime,
		TargetService:          spec.Service.Name,
		TargetServiceNamespace: targetServiceNamespace,
		Kind:                   kind,
		Winner:                 status.Assestment.Winner,
		ExperimentType:         status.ExperimentType,
	}
	i.CriteriaDetails = criterias
	i.TrafficControl = trafficControl

	i.Duration = spec.Duration
	i.ExperimentType = status.ExperimentType
}

func (i *Iter8ExperimentItem) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()

	i.Name = iter8Object.GetObjectMeta().Name
	i.Namespace = iter8Object.GetObjectMeta().Namespace
	i.Phase = status.Phase
	i.Status = status.Message
	i.InitTime = formatTime(status.InitTimeStamp.Time)
	i.StartTime = formatTime(status.StartTimeStamp.Time)
	if (status.StartTimeStamp != meta_v1.Time{}) {
		i.StartTime = status.StartTimeStamp.String()
	}
	if (status.EndTimestamp != meta_v1.Time{}) {
		i.EndTime = status.EndTimestamp.String()
	}

	baselineStatue := Iter8CandidateStatus{
		Name:           status.Assestment.Baseline.Name,
		Weight:         status.Assestment.Baseline.Weight,
		WinProbability: status.Assestment.Baseline.WinProbability,
	}
	candidateStatus := make([]Iter8CandidateStatus, len(status.Assestment.Candidates))
	for i, c := range status.Assestment.Candidates {
		cs := Iter8CandidateStatus{
			Name:           c.Name,
			Weight:         c.Weight,
			WinProbability: c.WinProbability,
		}
		candidateStatus[i] = cs
	}

	i.Baseline = baselineStatue
	i.Candidates = candidateStatus
	i.TargetService = spec.Service.Name
	i.TargetServiceNamespace = spec.Service.Namespace

	i.Kind = spec.Service.Kind
	if i.Kind == "" {
		i.Kind = "Deployment"
	}
	i.ExperimentType = status.ExperimentType
	i.Winner = status.Assestment.Winner
}

func (iter8URI *HTTPMatchRule) parse(uri *kubernetes.StringMatch) {

	if uri.Exact != nil {
		iter8URI.Match = "exact"
		iter8URI.StringMatch = *uri.Exact
	} else if uri.Prefix != nil {
		iter8URI.Match = "prefix"
		iter8URI.StringMatch = *uri.Prefix
	} else if uri.Regex != nil {
		iter8URI.Match = "regex"
		iter8URI.StringMatch = *uri.Regex
	}
}

func (hm *HTTPMatchRequest) parse(m *kubernetes.HTTPMatchRequest) {
	if m.URI != nil {
		header := HTTPMatchRule{}
		header.parse(m.URI)
		hm.URI = header
	}
	if len(m.Headers) > 0 {
		hm.Headers = make([]HTTPMatchRule, len(m.Headers))
		index := 0
		for ii, h := range m.Headers {
			if h != nil {
				header := HTTPMatchRule{}
				header.parse(h)
				header.Key = ii
				hm.Headers[index] = header
				index++
			}
		}
	}
}
