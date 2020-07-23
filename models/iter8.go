package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type Iter8Info struct {
	Enabled                bool   `json:"enabled"`
	SupportedVersion       bool   `json:"supportedVersion"`
	ControllerImageVersion string `json:"controllerImgVersion"`
	AnalyticsImageVersion  string `json:"analyticsImgVersion"`
}

type ExperimentAction struct {
	Action string `json:"action"`
}

// For Displaying Iter8 Experiment Details
type Iter8ExperimentItem struct {
	Name                   string   `json:"name"`
	Phase                  string   `json:"phase"`
	CreatedAt              int64    `json:"createdAt"`
	Status                 string   `json:"status"`
	Baseline               string   `json:"baseline"`
	BaselinePercentage     int      `json:"baselinePercentage"`
	BaselineVersion        string   `json:"baselineVersion"`
	Candidate              string   `json:"candidate"`
	CandidatePercentage    int      `json:"candidatePercentage"`
	CandidateVersion       string   `json:"candidateVersion"`
	Namespace              string   `json:"namespace"`
	StartedAt              int64    `json:"startedAt"`
	EndedAt                int64    `json:"endedAt"`
	TargetService          string   `json:"targetService"`
	TargetServiceNamespace string   `json:"targetServiceNamespace"`
	AssessmentConclusion   []string `json:"assessmentConclusion"`
	Kind                   string   `json:"kind"`
}

// For Displaying Iter8 Experiment Tabs
type Iter8ExperimentDetail struct {
	ExperimentItem  Iter8ExperimentItem   `json:"experimentItem"`
	CriteriaDetails []Iter8CriteriaDetail `json:"criterias"`
	Hosts           []Iter8Host           `json:"hosts"`
	TrafficControl  Iter8TrafficControl   `json:"trafficControl"`
	Permissions     ResourcePermissions   `json:"permissions"`
	Action          string                `json:"action"`
}

type Iter8CriteriaDetail struct {
	Name     string                     `json:"name"`
	Criteria Iter8Criteria              `json:"criteria"`
	Metric   Iter8Metric                `json:"metric"`
	Status   Iter8SuccessCrideriaStatus `json:"status"`
}

type Iter8Metric struct {
	AbsentValue        string `json:"absent_value"`
	IsCounter          bool   `json:"is_counter"`
	QueryTemplate      string `json:"query_template"`
	SampleSizeTemplate string `json:"sample_size_template"`
}

type Iter8SuccessCrideriaStatus struct {
	Conclusions         []string `json:"conclusions"`
	SuccessCriterionMet bool     `json:"success_criterion_met"`
	AbortExperiment     bool     `json:"abort_experiment"`
}

// Spec for Creating Experiment
type Iter8ExperimentSpec struct {
	Name           string              `json:"name"`
	Namespace      string              `json:"namespace"`
	Service        string              `json:"service"`
	APIVersion     string              `json:"apiversion"`
	Baseline       string              `json:"baseline"`
	Candidate      string              `json:"candidate"`
	TrafficControl Iter8TrafficControl `json:"trafficControl"`
	Criterias      []Iter8Criteria     `json:"criterias"`
	Hosts          []Iter8Host         `json:"hosts"`
	Action         string              `json:"action"`
	ExperimentKind string              `json:"experimentKind"`
}

type Iter8Host struct {
	Name    string `json:"name"`
	Gateway string `json:"gateway"`
}

type Iter8TrafficControl struct {
	Algorithm            string  `json:"algorithm"`
	Interval             string  `json:"interval"`
	MaxIterations        int     `json:"maxIterations"`
	MaxTrafficPercentage float64 `json:"maxTrafficPercentage"`
	TrafficStepSize      float64 `json:"trafficStepSize"`
}

type Iter8Criteria struct {
	Metric        string  `json:"metric"`
	ToleranceType string  `json:"toleranceType"`
	Tolerance     float64 `json:"tolerance"`
	SampleSize    int     `json:"sampleSize"`
	StopOnFailure bool    `json:"stopOnFailure"`
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
	i.Name = iter8Object.ExperimentItem.Name
	i.Namespace = iter8Object.ExperimentItem.Namespace
	i.Service = iter8Object.ExperimentItem.TargetService
	i.Candidate = iter8Object.ExperimentItem.Candidate
	i.Baseline = iter8Object.ExperimentItem.Baseline
	i.ExperimentKind = iter8Object.ExperimentItem.Kind
	i.TrafficControl = iter8Object.TrafficControl
	i.Criterias = make([]Iter8Criteria, len(iter8Object.CriteriaDetails))
	for k, c := range iter8Object.CriteriaDetails {
		i.Criterias[k] = c.Criteria
	}
}

func (i *Iter8ExperimentDetail) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()
	metrics := iter8Object.GetMetrics()

	criterias := make([]Iter8CriteriaDetail, len(spec.Analysis.SuccessCriteria))
	for i, c := range spec.Analysis.SuccessCriteria {
		metricName := c.MetricName
		successCrideriaStatus := Iter8SuccessCrideriaStatus{}
		for j, a := range status.Assestment.SuccessCriteriaStatus {
			if a.MetricName == c.MetricName {
				successCrideriaStatus = Iter8SuccessCrideriaStatus{
					status.Assestment.SuccessCriteriaStatus[j].Conclusions,
					status.Assestment.SuccessCriteriaStatus[j].SuccessCriterionMet,
					status.Assestment.SuccessCriteriaStatus[j].AbortExperiment,
				}
			}
		}
		criteriaDetail := Iter8CriteriaDetail{
			Name: c.MetricName,
			Criteria: Iter8Criteria{
				Metric:        c.MetricName,
				SampleSize:    c.SampleSize,
				Tolerance:     c.Tolerance,
				ToleranceType: c.ToleranceType,
				StopOnFailure: c.StopOnFailure,
			},
			Metric: Iter8Metric{
				AbsentValue:        metrics[metricName].AbsentValue,
				IsCounter:          metrics[metricName].IsCounter,
				QueryTemplate:      metrics[metricName].QueryTemplate,
				SampleSizeTemplate: metrics[metricName].SampleSizeTemplate,
			},
			Status: successCrideriaStatus,
		}
		criterias[i] = criteriaDetail
	}

	hosts := make([]Iter8Host, len(spec.TargetService.Hosts))
	for i, h := range spec.TargetService.Hosts {
		host := Iter8Host{}
		host.Name = h.Name
		host.Gateway = h.Gateway
		hosts[i] = host
	}
	trafficControl := Iter8TrafficControl{
		Algorithm:            spec.TrafficControl.Strategy,
		Interval:             spec.TrafficControl.Interval,
		MaxIterations:        spec.TrafficControl.MaxIterations,
		MaxTrafficPercentage: spec.TrafficControl.MaxTrafficPercentage,
		TrafficStepSize:      spec.TrafficControl.TrafficStepSize,
	}

	targetServiceNamespace := spec.TargetService.Namespace
	if targetServiceNamespace == "" {
		targetServiceNamespace = iter8Object.GetObjectMeta().Namespace
	}

	i.ExperimentItem = Iter8ExperimentItem{
		Name:                   iter8Object.GetObjectMeta().Name,
		Phase:                  status.Phase,
		Status:                 status.Message,
		Baseline:               spec.TargetService.Baseline,
		BaselinePercentage:     status.TrafficSplitPercentage.Baseline,
		Candidate:              spec.TargetService.Candidate,
		CandidatePercentage:    status.TrafficSplitPercentage.Candidate,
		CreatedAt:              status.CreateTimeStamp,
		StartedAt:              status.StartTimeStamp,
		EndedAt:                status.EndTimestamp,
		TargetService:          spec.TargetService.Name,
		TargetServiceNamespace: targetServiceNamespace,
		AssessmentConclusion:   status.Assestment.Conclusions,
		Kind:                   spec.TargetService.Kind,
	}
	i.CriteriaDetails = criterias
	i.TrafficControl = trafficControl
	i.Hosts = hosts
}

func (i *Iter8ExperimentItem) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()

	i.Name = iter8Object.GetObjectMeta().Name
	i.Namespace = iter8Object.GetObjectMeta().Namespace
	i.Phase = status.Phase
	i.Status = status.Message
	i.CreatedAt = iter8Object.GetStatus().CreateTimeStamp
	i.StartedAt = iter8Object.GetStatus().StartTimeStamp
	i.EndedAt = iter8Object.GetStatus().EndTimestamp

	i.Baseline = spec.TargetService.Baseline
	i.BaselinePercentage = status.TrafficSplitPercentage.Baseline
	i.Candidate = spec.TargetService.Candidate
	i.CandidatePercentage = status.TrafficSplitPercentage.Candidate
	i.TargetService = spec.TargetService.Name
	i.TargetServiceNamespace = spec.TargetService.Namespace

	i.Kind = spec.TargetService.Kind
}
