package kubernetes

import (
	"fmt"

	"gopkg.in/yaml.v2"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
)

var iter8typeMeta = meta_v1.TypeMeta{
	Kind:       PluralType[Iter8Experiments],
	APIVersion: ApiIter8Version,
}

// Linked with https://github.com/iter8-tools/iter8-controller/blob/master/pkg/apis/iter8/v1alpha2/experiment_types.go
// ExperimentSpec defines the desired state of Experiment
type Iter8ExperimentSpec struct {
	Service struct {
		core_v1.ObjectReference `json:",inline"`
		Baseline                string   `json:"baseline"`
		Candidates              []string `json:"candidates"`
		Port                    *int32   `json:"port,omitempty"`
	} `json:"service"`

	Criteria []struct {
		Metric    string          `json:"metric"`
		Threshold *Iter8Threshold `json:"threshold,omitempty"`
		IsReward  bool            `json:"isReward,omitempty"`
	} `json:"criteria,omitempty"`
	TrafficControl struct {
		Strategy      string `json:"strategy,omitempty"`
		OnTermination string `json:"onTermination,omitempty"`
		Match         struct {
			HTTP []*HTTPMatchRequest `json:"http,omitempty"`
		} `json:"match,omitempty"`
		Percentage   int32 `json:"percentage,omitempty"`
		MaxIncrement int32 `json:"maxIncrement,omitempty"`
	} `json:"trafficControl,omitempty"`
	AnalyticsEndpoint string        `json:"analyticsEndpoint,omitempty"`
	Duration          Iter8Duration `json:"duration,omitempty"`
	Cleanup           bool          `json:"cleanup,omitempty"`
	Metrics           struct {
		CounterMetrics []CounterMetric `json:"counter_metrics,omitempty"`
		RatioMetrics   []RatioMetric   `json:"ratio_metrics,omitempty"`
	} `json:"metrics,omitempty"`
	ManualOverride *ExperimentAction `json:"manualOverride,omitempty"`
	Networking     *Iter8Networking  `json:"networking,omitempty"`
}

type Iter8Duration struct {
	Interval      *string `json:"interval,omitempty"`
	MaxIterations *int32  `json:"maxIterations,omitempty"`
}
type Iter8Threshold struct {
	Type                     string  `json:"type,omitempty"`
	Value                    float32 `json:"value,omitempty"`
	CutoffTrafficOnViolation bool    `json:"cutoffTrafficOnViolation,omitempty"`
}

type ExperimentAction struct {
	Action       string           `json:"action"`
	TrafficSplit map[string]int32 `json:"trafficSplit,omitempty"`
}

type Iter8Networking struct {
	// id of router
	// +optional
	ID string `json:"id,omitempty"`

	// List of hosts used to receive external traffic
	// +optional
	Hosts []Iter8Host `json:"hosts,omitempty"`
}
type CounterMetric struct {
	Name               string  `json:"name" yaml:"name"`
	QueryTemplate      string  `json:"query_template" yaml:"query_template"`
	PreferredDirection *string `json:"preferred_direction,omitempty" yaml:"preferred_direction,omitempty"`
	Unit               *string `json:"unit,omitempty" yaml:"unit,omitempty"`
}

type RatioMetric struct {
	Name               string  `json:"name" yaml:"name"`
	Numerator          string  `json:"numerator" yaml:"numerator"`
	Denominator        string  `json:"denominator" yaml:"denominator"`
	ZeroToOne          *bool   `json:"zero_to_one,omitempty" yaml:"zero_to_one,omitempty"`
	PreferredDirection *string `json:"preferred_direction,omitempty" yaml:"preferred_direction,omitempty"`
}

type Iter8ExperimentAction string
type Iter8Host struct {
	Name    string `json:"name"`
	Gateway string `json:"gateway"`
}

type Iter8CriterionAssessment struct {
	ID         string `json:"id"`
	MetricID   string `json:"metric_id"`
	Statistics struct {
		Value           *float32 `json:"value,omitempty"`
		RatioStatistics struct {
			ImprovementOverBaseline struct {
				Lower *float32 `json:"lower"`
				Upper *float32 `json:"upper"`
			} `json:"improvement_over_baseline"`
			ProbabilityOfBeatingBaseline  *float32 `json:"probability_of_beating_baseline"`
			ProbabilityOfBeingBestVersion *float32 `json:"probability_of_being_best_version"`
			CredibleInterval              struct {
				Lower *float32 `json:"lower"`
				Upper *float32 `json:"upper"`
			} `json:"credible_interval"`
		} `json:"ratio_statistics,omitempty"`
	} `json:"statistics,omitempty"`
	ThresholdAssessment *struct {
		ThresholdBreached                bool     `json:"threshold_breached"`
		ProbabilityOfSatisfyingTHreshold *float32 `json:"probability_of_satisfying_threshold"`
	} `json:"threshold_assessment,omitempty"`
}

type Iter8VersionAssessment struct {
	ID                   string                     `json:"id"`
	Name                 string                     `json:"name"`
	Weight               int32                      `json:"weight"`
	WinProbability       float32                    `json:"win_probability"`
	RequestCount         int32                      `json:"request_count"`
	CriterionAssessments []Iter8CriterionAssessment `json:"criterion_assessments,omitempty"`
	Rollback             bool
}

type Iter8ExperimentStatus struct {
	Conditions []struct {
		LastTransitionTime string `json:"lastTransitionTime"`
		Message            string `json:"message"`
		Reason             string `json:"reason"`
		Status             string `json:"status"`
		Type               string `json:"type"`
	} `json:"conditions"`
	InitTimeStamp    meta_v1.Time           `json:"initTimestamp"`
	StartTimeStamp   meta_v1.Time           `json:"startTimestamp"`
	EndTimestamp     meta_v1.Time           `json:"endTimestamp,omitempty"`
	LastUpdateTime   string                 `json:"lastUpdateTime"`
	CurrentIteration int                    `json:"currentIteration"`
	AnalysisState    map[string]interface{} `json:"analysisState"`
	GrafanaURL       string                 `json:"grafanaURL"`
	Assestment       struct {
		Baseline   Iter8VersionAssessment   `json:"baseline"`
		Candidates []Iter8VersionAssessment `json:"candidates"`
		Winner     struct {
			Name        *string  `json:"name,omitempty"`
			WinnerFound *bool    `json:"winning_version_found"`
			Winner      string   `json:"current_best_version,omitempty"`
			Probability *float32 `json:"probability_of_winning_for_best_version,omitempty"`
		} `json:"winner"`
	} `json:"assessment"`
	Phase          string   `json:"phase"`
	Message        string   `json:"message"`
	ExperimentType string   `json:"experimentType,omitempty"`
	EffectiveHosts []string `json:"effectiveHosts,omitempty"`
}

type HTTPMatchRequest struct {
	// The name assigned to a match.
	Name string `json:"name,omitempty"`

	// URI to match
	URI *StringMatch `json:"uri,omitempty"`

	// Scheme Scheme
	Scheme *StringMatch `json:"scheme,omitempty"`

	// HTTP Method
	Method *StringMatch `json:"method,omitempty"`

	// HTTP Authority
	Authority *StringMatch `json:"authority,omitempty"`

	// Headers to match
	Headers map[string]*StringMatch `json:"headers,omitempty"`

	// Specifies the ports on the host that is being addressed.
	Port uint32 `json:"port,omitempty"`

	// SourceLabels for matching
	SourceLabels map[string]string `json:"sourceLabels,omitempty"`

	// Gateways for matching
	Gateways []string `json:"gateways,omitempty"`

	// Query parameters for matching.
	QueryParams map[string]StringMatch `json:"query_params,omitempty"`

	// Flag to specify whether the URI matching should be case-insensitive.
	IgnoreURICase bool `json:"ignore_uri_case,omitempty"`
}

type StringMatch struct {
	Exact  *string `json:"exact,omitempty"`
	Prefix *string `json:"prefix,omitempty"`
	Regex  *string `json:"regex,omitempty"`
}

type Iter8ExperimentMetrics map[string]struct {
	AbsentValue        string `json:"absent_value,omitempty"`
	IsCounter          bool   `json:"is_counter,omitempty"`
	QueryTemplate      string `json:"query_template,omitempty"`
	SampleSizeTemplate string `json:"sample_size_template,omitempty"`
}

// Iter8Experiment is a dynamic object to map Iter8 Experiments
type Iter8Experiment interface {
	runtime.Object
	GetSpec() Iter8ExperimentSpec
	SetSpec(Iter8ExperimentSpec)
	GetStatus() Iter8ExperimentStatus
	SetStatus(Iter8ExperimentStatus)
	GetTypeMeta() meta_v1.TypeMeta
	SetTypeMeta(meta_v1.TypeMeta)
	GetObjectMeta() meta_v1.ObjectMeta
	SetObjectMeta(meta_v1.ObjectMeta)
	DeepCopyIter8Object() Iter8Experiment
}

type Iter8ExperimentList interface {
	runtime.Object
	GetItems() []Iter8Experiment
}

type Iter8ExperimentCRD struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata,omitempty"`

	Spec Iter8ExperimentSpec `json:"spec"`
}

type Iter8ExperimentObject struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata,omitempty"`

	Spec Iter8ExperimentSpec `json:"spec"`
	// +optional
	Status Iter8ExperimentStatus `json:"status,omitempty"`
}

type Iter8ExperimentObjectList struct {
	meta_v1.TypeMeta `json:",inline"`
	meta_v1.ListMeta `json:"metadata"`
	Items            []Iter8ExperimentObject `json:"items"`
}

// GetSpec from a wrapper
func (in *Iter8ExperimentObject) GetSpec() Iter8ExperimentSpec {
	return in.Spec
}

// SetSpec for a wrapper
func (in *Iter8ExperimentObject) SetSpec(spec Iter8ExperimentSpec) {
	in.Spec = spec
}

func (in *Iter8ExperimentObject) GetStatus() Iter8ExperimentStatus {
	return in.Status
}

// SetStatus for a wrapper
func (in *Iter8ExperimentObject) SetStatus(status Iter8ExperimentStatus) {
	in.Status = status
}

// GetTypeMeta from a wrapper
func (in *Iter8ExperimentObject) GetTypeMeta() meta_v1.TypeMeta {
	return in.TypeMeta
}

// SetObjectMeta for a wrapper
func (in *Iter8ExperimentObject) SetTypeMeta(typemeta meta_v1.TypeMeta) {
	in.TypeMeta = typemeta
}

// GetObjectMeta from a wrapper
func (in *Iter8ExperimentObject) GetObjectMeta() meta_v1.ObjectMeta {
	return in.ObjectMeta
}

// SetObjectMeta for a wrapper
func (in *Iter8ExperimentObject) SetObjectMeta(metadata meta_v1.ObjectMeta) {
	in.ObjectMeta = metadata
}

// GetItems from a wrapper
func (in *Iter8ExperimentObjectList) GetItems() []Iter8Experiment {
	out := make([]Iter8Experiment, len(in.Items))
	for i := range in.Items {
		out[i] = &in.Items[i]
	}
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Iter8ExperimentObject) DeepCopyInto(out *Iter8ExperimentObject) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = in.Spec
	out.Status = in.Status
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GenericIstioObject.
func (in *Iter8ExperimentObject) DeepCopy() *Iter8ExperimentObject {
	if in == nil {
		return nil
	}
	out := new(Iter8ExperimentObject)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *Iter8ExperimentObject) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

func (in *Iter8ExperimentObject) DeepCopyIter8Object() Iter8Experiment {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Iter8ExperimentObjectList) DeepCopyInto(out *Iter8ExperimentObjectList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	out.ListMeta = in.ListMeta
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]Iter8ExperimentObject, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GenericIstioObjectList.
func (in *Iter8ExperimentObjectList) DeepCopy() *Iter8ExperimentObjectList {
	if in == nil {
		return nil
	}
	out := new(Iter8ExperimentObjectList)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *Iter8ExperimentObjectList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

type Iter8ClientInterface interface {
	CreateIter8Experiment(namespace string, json string) (Iter8Experiment, error)
	UpdateIter8Experiment(namespace string, name string, json string) (Iter8Experiment, error)
	DeleteIter8Experiment(namespace string, name string) error
	GetIter8Experiment(namespace string, name string) (Iter8Experiment, error)
	GetIter8Experiments(namespace string) ([]Iter8Experiment, error)
	IsIter8Api() bool
	Iter8MetricMap() ([]string, error)
}

func (in *K8SClient) IsIter8Api() bool {
	if in.isIter8Api == nil {
		isIter8Api := false
		_, err := in.k8s.RESTClient().Get().AbsPath("/apis/iter8.tools").Do(in.ctx).Raw()
		if err == nil {

			isIter8Api = true
		}
		in.isIter8Api = &isIter8Api
	}
	return *in.isIter8Api
}

func (in *K8SClient) Iter8MetricMap() ([]string, error) {
	conf := config.Get()
	mnames := make([]string, 0)
	var result = &core_v1.ConfigMap{}
	err := in.k8s.CoreV1().RESTClient().Get().Namespace(conf.Extensions.Iter8.Namespace).Resource("configmaps").
		Name(Iter8ConfigMap).Do(in.ctx).Into(result)
	if err == nil {
		metrics := []RatioMetric{}
		err = yaml.Unmarshal([]byte(result.Data["ratio_metrics.yaml"]), &metrics)
		if err == nil {
			for _, m := range metrics {
				mnames = append(mnames, m.Name)
			}

		}
	}
	return mnames, err
}

func (in *K8SClient) CreateIter8Experiment(namespace string, json string) (Iter8Experiment, error) {
	var result runtime.Object
	var err error
	byteJson := []byte(json)
	result, err = in.iter8Api.Post().Namespace(namespace).Resource(Iter8Experiments).Body(byteJson).Do(in.ctx).Get()
	if err != nil {
		return nil, err
	}
	iter8ExperimentObject, ok := result.(*Iter8ExperimentObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Iter8 Experiment object", namespace)
	}
	i8 := iter8ExperimentObject.DeepCopyIter8Object()
	i8.SetTypeMeta(iter8typeMeta)
	return i8, nil
}

func (in *K8SClient) UpdateIter8Experiment(namespace string, name string, json string) (Iter8Experiment, error) {
	var result runtime.Object
	var err error
	byteJson := []byte(json)
	result, err = in.iter8Api.Patch(types.MergePatchType).Namespace(namespace).Resource(Iter8Experiments).SubResource(name).Body(byteJson).Do(in.ctx).Get()
	if err != nil {
		return nil, err
	}
	iter8ExperimentObject, ok := result.(*Iter8ExperimentObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Iter8 Experiment object", namespace)
	}
	i8 := iter8ExperimentObject.DeepCopyIter8Object()
	i8.SetTypeMeta(iter8typeMeta)
	return i8, nil
}

func (in *K8SClient) GetIter8Experiment(namespace string, name string) (Iter8Experiment, error) {
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(Iter8Experiments).SubResource(name).Do(in.ctx).Get()
	if err != nil {
		return nil, err
	}
	iter8ExperimentObject, ok := result.(*Iter8ExperimentObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Iter8 Experiment object", namespace, name)
	}
	i8 := iter8ExperimentObject.DeepCopyIter8Object()
	i8.SetTypeMeta(iter8typeMeta)
	return i8, nil
}

func (in *K8SClient) GetIter8Experiments(namespace string) ([]Iter8Experiment, error) {
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(Iter8Experiments).Do(in.ctx).Get()
	if err != nil {
		return nil, err
	}
	iter8ExperimentList, ok := result.(*Iter8ExperimentObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Iter8 Experiment list", namespace)
	}
	iter8Experiments := make([]Iter8Experiment, 0)
	for _, iter8Experiment := range iter8ExperimentList.GetItems() {
		i8 := iter8Experiment.DeepCopyIter8Object()
		i8.SetTypeMeta(iter8typeMeta)
		iter8Experiments = append(iter8Experiments, i8)
	}
	return iter8Experiments, nil
}

func (in *K8SClient) DeleteIter8Experiment(namespace string, name string) error {
	var err error
	_, err = in.iter8Api.Delete().Namespace(namespace).Resource(Iter8Experiments).Name(name).Do(in.ctx).Get()
	return err
}
