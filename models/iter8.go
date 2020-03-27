package models

import (
	"strings"
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type Iter8Info struct {
	Enabled bool `json:"enabled"`
}

type Iter8ExperimentItem struct {
	Name                   string `json:"name"`
	Phase                  string `json:"phase"`
	CreatedAt              string `json:"createdAt"`
	Status                 string `json:"status"`
	Baseline               string `json:"baseline"`
	BaselinePercentage     int    `json:"baselinePercentage"`
	Candidate              string `json:"candidate"`
	CandidatePercentage    int    `json:"candidatePercentage"`
	Namespace              string `json:"namespace"`
	StartedAt              string `json:"startedAt"`
	EndedAt                string `json:"endedAt"`
	TargetService          string `json:"targetService"`
	TargetServiceNamespace string `json:"targetServiceNamespace"`
	AssessmentConclusion   string `json:"assessmentConclusion"`
}

type Iter8ExperimentDetail struct {
	ExperimentItem  Iter8ExperimentItem   `json:"experimentItem"`
	CriteriaDetails []Iter8CriteriaDetail `json:"criterias"`
	TrafficControl  Iter8TrafficControl   `json:"trafficControl"`
	Permissions     ResourcePermissions   `json:"permissions"`
}

type Iter8CriteriaDetail struct {
	Name     string        `json:"name"`
	Criteria Iter8Criteria `json:"criteria"`
	Metric   Iter8Metric   `json:"metric"`
}

type Iter8Metric struct {
	AbsentValue        string `json:"absent_value"`
	IsCounter          bool   `json:"is_counter"`
	QueryTemplate      string `json:"query_template"`
	SampleSizeTemplate string `json:"sample_size_template"`
}

type Iter8ExperimentSpec struct {
	Name           string              `json:"name"`
	Namespace      string              `json:"namespace"`
	Service        string              `json:"service"`
	APIVersion     string              `json:"apiversion"`
	Baseline       string              `json:"baseline"`
	Candidate      string              `json:"candidate"`
	TrafficControl Iter8TrafficControl `json:"trafficControl"`
	Criterias      []Iter8Criteria     `json:"criterias"`
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

func (i *Iter8ExperimentDetail) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()
	metrics := iter8Object.GetMetrics()

	criterias := make([]Iter8CriteriaDetail, len(spec.Analysis.SuccessCriteria))
	for i, c := range spec.Analysis.SuccessCriteria {
		metricName := c.MetricName
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
		}
		criterias[i] = criteriaDetail
	}

	trafficControl := Iter8TrafficControl{
		Algorithm:            spec.TrafficControl.Strategy,
		Interval:             spec.TrafficControl.Interval,
		MaxIterations:        spec.TrafficControl.MaxIterations,
		MaxTrafficPercentage: spec.TrafficControl.MaxTrafficPercentage,
		TrafficStepSize:      spec.TrafficControl.TrafficStepSize,
	}

	startTimeString := time.Unix(0, status.StartTimeStamp*int64(1000000)).Format(time.RFC1123)
	endTimeString := time.Unix(0, status.EndTimestamp*int64(1000000)).Format(time.RFC1123)
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
		StartedAt:              startTimeString,
		EndedAt:                endTimeString,
		TargetService:          spec.TargetService.Name,
		TargetServiceNamespace: targetServiceNamespace,
		AssessmentConclusion:   strings.Join(status.Assestment.Conclusions, ";"),
	}
	i.CriteriaDetails = criterias
	i.TrafficControl = trafficControl
}

func (i *Iter8ExperimentItem) Parse(iter8Object kubernetes.Iter8Experiment) {

	spec := iter8Object.GetSpec()
	status := iter8Object.GetStatus()

	i.Name = iter8Object.GetObjectMeta().Name
	i.Namespace = iter8Object.GetObjectMeta().Namespace
	i.Phase = status.Phase
	i.Status = status.Message
	i.CreatedAt = iter8Object.GetObjectMeta().CreationTimestamp.UTC().Format(time.RFC3339)
	i.Baseline = spec.TargetService.Baseline
	i.BaselinePercentage = status.TrafficSplitPercentage.Baseline
	i.Candidate = spec.TargetService.Candidate
	i.CandidatePercentage = status.TrafficSplitPercentage.Candidate
	i.TargetService = spec.TargetService.Name
	i.TargetServiceNamespace = spec.TargetService.Namespace
}
