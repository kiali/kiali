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

// Linked with https://github.com/iter8-tools/iter8-controller/blob/master/pkg/apis/iter8/v1alpha1/experiment_types.go
type Iter8ExperimentSpec struct {
	TargetService struct {
		ApiVersion string `json:"apiVersion"`
		Name       string `json:"name"`
		Namespace  string `json:"namespace"`
		Kind       string `json:"kind"`
		Baseline   string `json:"baseline"`
		Candidate  string `json:"candidate"`
		Hosts      []struct {
			Name    string `json:"name"`
			Gateway string `json:"gateway"`
		} `json:"hosts,omitempty"`
	} `json:"targetService"`
	TrafficControl struct {
		Strategy             string  `json:"strategy,omitempty"`
		MaxTrafficPercentage float64 `json:"maxTrafficPercentage,omitempty"`
		TrafficStepSize      float64 `json:"trafficStepSize,omitempty"`
		Interval             string  `json:"interval,omitempty"`
		MaxIterations        int     `json:"maxIterations,omitempty"`
		OnSuccess            string  `json:"onSuccess,omitempty"`
		Confidence           float64 `json:"confidence,omitempty"`
	} `json:"trafficControl,omitempty"`
	Analysis struct {
		AnalyticsService string `json:"analyticsService,omitempty"`
		GrafanaEndpoint  string `json:"grafanaEndpoint,omitempty"`
		SuccessCriteria  []struct {
			MetricName    string  `json:"metricName,omitempty"`
			ToleranceType string  `json:"toleranceType,omitempty"`
			Tolerance     float64 `json:"tolerance,omitempty"`
			SampleSize    int     `json:"sampleSize,omitempty"`
			MinMax        struct {
				Min float64 `json:"min,omitempty"`
				Max float64 `json:"max,omitempty"`
			} `json:"min_max,omitempty"`
			StopOnFailure bool `json:"stopOnFailure,omitempty"`
		} `json:"successCriteria,omitempty"`
		Reward *struct {
			MetricName string `json:"metricName,omitempty"`
			MinMax     string `json:"min_max,omitempty"`
		} `json:"reward,omitempty"`
	} `json:"analysis,omitempty"`
	Assessment       string                   `json:"assessment,omitempty"`
	Cleanup          string                   `json:"cleanup,omitempty"`
	RoutingReference *core_v1.ObjectReference `json:"routingReference,omitempty"`
}

type Iter8ExperimentAction string
type Iter8Host struct {
	// Name of the Host
	Name string `json:"name"`
	// The gateway
	Gateway string `json:"gateway"`
}

type Iter8ExperimentStatus struct {
	Conditions []struct {
		LastTransitionTime string `json:"lastTransitionTime"`
		Message            string `json:"message"`
		Reason             string `json:"reason"`
		Status             string `json:"status"`
		Type               string `json:"type"`
	} `json:"conditions"`
	CreateTimeStamp   int64                  `json:"createTimestamp"`
	StartTimeStamp    int64                  `json:"startTimestamp"`
	EndTimestamp      int64                  `json:"endTimestamp"`
	LastIncrementTime string                 `json:"lastIncrementTime"`
	CurrentIteration  int                    `json:"currentIteration"`
	AnalysisState     map[string]interface{} `json:"analysisState"`
	GrafanaURL        string                 `json:"grafanaURL"`
	Assestment        struct {
		Conclusions           []string `json:"conclusions"`
		AllSuccessCriteriaMet bool     `json:"all_success_criteria_met,omitempty"`
		AbortExperiment       bool     `json:"abort_experiment,omitempty"`
		SuccessCriteriaStatus []struct {
			// Name of the metric to which the criterion applies
			// example: iter8_latency
			MetricName string `json:"metric_name"`

			// Assessment of this success criteria in plain English
			Conclusions []string `json:"conclusions"`

			// Indicates whether or not the success criterion for the corresponding metric has been met
			SuccessCriterionMet bool `json:"success_criterion_met"`

			// Indicates whether or not the experiment must be aborted on the basis of the criterion for this metric
			AbortExperiment bool `json:"abort_experiment"`
		} `json:"success_criteria,omitempty"`
	} `json:"assessment"`
	TrafficSplitPercentage struct {
		Baseline  int `json:"baseline"`
		Candidate int `json:"candidate"`
	} `json:"trafficSplitPercentage"`
	Phase   string `json:"phase"`
	Message string `json:"message"`
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
	GetMetrics() Iter8ExperimentMetrics
	SetMetrics(Iter8ExperimentMetrics)
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

type Iter8ExperimentObject struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata"`
	Spec               Iter8ExperimentSpec    `json:"spec"`
	Status             Iter8ExperimentStatus  `json:"status"`
	Metrics            Iter8ExperimentMetrics `json:"metrics"`
	Action             Iter8ExperimentAction  `json:"action,omitempty"`
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

func (in *Iter8ExperimentObject) GetMetrics() Iter8ExperimentMetrics {
	return in.Metrics
}

// SetSpec for a wrapper
func (in *Iter8ExperimentObject) SetMetrics(metrics Iter8ExperimentMetrics) {
	in.Metrics = metrics
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
	out.Metrics = in.Metrics
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

// Metric structure of cm/iter8_metric
type Iter8AnalyticMetric struct {
	Name               string `yaml:"name"`
	IsCounter          bool   `yaml:"is_counter"`
	AbsentValue        string `yaml:"absent_value"`
	SampleSizeTemplate string `yaml:"sample_size_query_template"`
}

type Iter8ClientInterface interface {
	CreateIter8Experiment(namespace string, json string) (Iter8Experiment, error)
	UpdateIter8Experiment(namespace string, name string, json string) (Iter8Experiment, error)
	DeleteIter8Experiment(namespace string, name string) error
	GetIter8Experiment(namespace string, name string) (Iter8Experiment, error)
	GetIter8Experiments(namespace string) ([]Iter8Experiment, error)
	IsIter8Api() bool
	Iter8ConfigMap() ([]string, error)
}

func (in *K8SClient) IsIter8Api() bool {
	if in.isIter8Api == nil {
		isIter8Api := false
		_, err := in.k8s.RESTClient().Get().AbsPath("/apis/iter8.tools").Do().Raw()
		if err == nil {

			isIter8Api = true
		}
		in.isIter8Api = &isIter8Api
	}
	return *in.isIter8Api
}

func (in *K8SClient) Iter8ConfigMap() ([]string, error) {
	conf := config.Get()
	mnames := make([]string, 0)
	var result = &core_v1.ConfigMap{}
	err := in.k8s.CoreV1().RESTClient().Get().Namespace(conf.Extensions.Iter8.Namespace).Resource("configmaps").
		Name(Iter8ConfigMap).Do().Into(result)
	if err == nil {
		metrics := []Iter8AnalyticMetric{}
		err = yaml.Unmarshal([]byte(result.Data["metrics"]), &metrics)
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
	result, err = in.iter8Api.Post().Namespace(namespace).Resource(Iter8Experiments).Body(byteJson).Do().Get()
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
	result, err = in.iter8Api.Patch(types.MergePatchType).Namespace(namespace).Resource(Iter8Experiments).SubResource(name).Body(byteJson).Do().Get()
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
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(Iter8Experiments).SubResource(name).Do().Get()
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
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(Iter8Experiments).Do().Get()
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
	_, err = in.iter8Api.Delete().Namespace(namespace).Resource(Iter8Experiments).Name(name).Do().Get()
	return err
}
