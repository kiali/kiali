package kubernetes

import (
	"fmt"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var iter8typeMeta = meta_v1.TypeMeta{
	Kind:       PluralType[iter8experiments],
	APIVersion: ApiIter8Version,
}

// https://github.com/iter8-tools/docs/blob/master/doc_files/iter8_crd.md
/*
spec:
    # targetService specifies the reference to experiment targets
    targetService:

      # apiVersion of the target service (required)
      # options:
      #   v1: indicates that the target service is a Kubernetes service
      #   serving.knative.dev/v1alpha1: indicates that the target service is a Knative service
      apiVersion: v1

      # name of target service (required)
      # identifies either a Kubernetes service or a Knative service
      name: reviews

      # the baseline and candidate versions of the target service (required)
      # for Kubernetes, these two components refer to names of deployments
      # for Knative, they are names of revisions
      baseline: reviews-v3
      candidate: reviews-v5

    # routingReference is a reference to an existing Istio VirtualService (optional)
    # this should be used only if an Istio VirtualService has already been defined for the target Kubernetes service
    routingReference:
      apiversion: networking.istio.io/v1alpha3
      kind: VirtualService
      name: reviews-external

    # analysis contains the parameters for configuring the analytics service
    analysis:

      # analyticsService specifies analytics service endpoint (optional)
      # default value is http://iter8-analytics.iter8
      analyticsService: http://iter8-analytics.iter8

      # endpoint to Grafana dashboard (optional)
      # default is http://localhost:3000
      grafanaEndpoint: http://localhost:3000

      # successCriteria is a list of criteria for assessing the candidate version (optional)
      # if the list is empty, the controller will not rely on the analytics service
      successCriteria:

      # metricName: name of the metric to which this criterion applies (required)
      # the name should match the name of an iter8 metric or that of a user-defined custom metric
      # names of metrics supported by iter8 out of the box:
      #   iter8_latency: mean latency of the service
      #   iter8_error_rate: mean error rate (~5** HTTP Status codes) of the service
      #   iter8_error_count: total error count (~5** HTTP Status codes) of the service
      - metricName: iter8_latency

        # minimum number of data points required to make a decision based on this criterion (optional)
        # default is 10
        # Used by the check and increment alogorithm.
        # Ignored by other algorithms.
        sampleSize: 100

        # the metric value for the candidate version defining this success criterion (required)
        # it can be an absolute threshold or one relative to the baseline version, depending on the
        # attribute toleranceType described next
        tolerance: 0.2

        # indicates if the tolerance value above should be interpreted as an absolute threshold or
        # a threshold relative to the baseline (required)
        # options:
        #   threshold: the metric value for the candidate must be below the tolerance value above
        #   delta: the tolerance value above indicates the percentage within which the candidate metric value can deviate
        # from the baseline metric value
        toleranceType: threshold

        # The range of possible metric values (optional)
        # Used by bayesian routing algorithms if available.
        # Ignored by other algorithms.
        min_max:
          # The minimum possible value for the metric
          min: 0.0

          # The maximum possible value for the metric
          max: 1.0

        # indicates whether or not the experiment must finish if this criterion is not satisfied (optional)
        # default is false
        stopOnFailure: false

    # trafficControl controls the experiment durarion and how the controller should change the traffic split
    trafficControl:

      # frequency with which the controller calls the analytics service
      # it corresponds to the duration of each "iteration" of the experiment
      interval: 30s

      # maximum number of iterations for this experiment (optional)
      # the duration of an experiment is defined by maxIterations * internal
      # default is 100
      maxIterations: 6

      # the maximum traffic percentage to send to the candidate during an experiment (optional)
      # default is 50
      maxTrafficPercentage: 80

      # strategy used to analyze the candidate and shift the traffic (optional)
      # except for the strategy increment_without_check, the analytics service is called
      # at each iteration and responds with the appropriate traffic split which the controller honors
      # options:
      #   check_and_increment
      #   epsilon_greedy
      #   posterior_bayesian_routing
      #   optimistic_bayesian_routing
      #   increment_without_check: increase traffic to candidate by trafficStepSize at each iteration without calling analytics
      # default is check_and_increment
      strategy: check_and_increment

      # the maximum traffic increment per iteration (optional)
      # default is 2.0
      trafficStepSize: 20

      # The required confidence in the recommeded traffic split (optional)
      # default is 0.95
      # Used by bayesian routing algorithms
      # Ignored by other algorithms
      confidence: 0.9

      # determines how the traffic must be split at the end of the experiment (optional)
      # options:
      #   baseline: all traffic goes to the baseline version
      #   candidate: all traffic goes to the candidate version
      #   both: traffic is split across baseline and candidate
      # default is candidate
      onSuccess: candidate

    # a flag that allows the user to terminate an ongoing experiment (optional)
    # options:
    #   override_success: terminate the experiment indicating that the candidate succeeded
    #   override_failure: abort the experiment indicating that the candidate failed
    # default is the empty string
    assessment: ""

    # indicates whether or not iter8 should perform a clean-up action at the end of the experiment (optional)
    # if no action is specified, nothing is done to clean up at the end
    # if used, the currently supported actions are:
    #   delete: at the end of the experiment, the version that ends up with no traffic (if any) is deleted
    cleanup:
*/
type Iter8ExperimentSpec struct {
	TargetService struct {
		ApiVersion string `json:"apiVersion"`
		Name       string `json:"name"`
		Baseline   string `json:"baseline"`
		Candidate  string `json:"candidate"`
	} `json:"targetService"`
	RoutingReference struct {
		ApiVersion string `json:"apiVersion"`
		Kind       string `json:"kind"`
		Name       string `json:"name"`
	} `json:"routingReference"`
	Analysis struct {
		AnalyticsService string `json:"analyticsService"`
		GrafanaEndpoint  string `json:"grafanaEndpoint"`
		SuccessCriteria  []struct {
			MetricName    string  `json:"metricName"`
			SampleSize    int     `json:"sampleSize"`
			Tolerance     float64 `json:"tolerance"`
			ToleranceType string  `json:"toleranceType"`
			MinMax        struct {
				Min float64 `json:"min"`
				Max float64 `json:"max"`
			} `json:"min_max"`
			StopOnFailure bool `json:"stopOnFailure"`
		} `json:"successCriteria"`
	} `json:"analysis"`
	TrafficControl struct {
		Interval             string  `json:"interval"`
		MaxIterations        int     `json:"maxIterations"`
		MaxTrafficPercentage float64 `json:"maxTrafficPercentage"`
		Strategy             string  `json:"strategy"`
		TrafficStepSize      float64 `json:"trafficStepSize"`
		Confidence           float64 `json:"confidence"`
		OnSuccess            string  `json:"onSuccess"`
	} `json:"trafficControl"`
	Assessment string `json:"assessment"`
	Cleanup    string `json:"cleanup"`
}

/*
	metrics:
	  iter8_latency:
		absent_value: None
		is_counter: false
		query_template: (sum(increase(istio_request_duration_seconds_sum{source_workload_namespace!='knative-serving',reporter='source'}[$interval]$offset_str))
		  by ($entity_labels)) / (sum(increase(istio_request_duration_seconds_count{source_workload_namespace!='knative-serving',reporter='source'}[$interval]$offset_str))
		  by ($entity_labels))
		sample_size_template: sum(increase(istio_requests_total{source_workload_namespace!='knative-serving',reporter='source'}[$interval]$offset_str))
		  by ($entity_labels)
*/
type Iter8ExperimentMetrics map[string]struct {
	AbsentValue        string `json:"absent_value"`
	IsCounter          bool   `json:"is_counter"`
	QueryTemplate      string `json:"query_template"`
	SampleSizeTemplate string `json:"sample_size_template"`
}

/*
  status:
    # the last analysis state
    analysisState: {}

    # assessment returned from the analytics service
    assessment:
      conclusions:
      - The experiment needs to be aborted
      - All success criteria were not met

    # list of boolean conditions describing the status of the experiment
    # for each condition, if the status is "False", the reason field will give detailed explanations
    # lastTransitionTime records the time when the last change happened to the corresponding condition
    # when a condition is not set, its status will be "Unknown"
    conditions:

    # AnalyticsServiceNormal is "True" when the controller can get an interpretable response from the analytics service
    - lastTransitionTime: "2019-12-20T05:38:37Z"
      status: "True"
      type: AnalyticsServiceNormal

    # ExperimentCompleted tells whether the experiment is completed or not
    - lasv1alpha1.Phase		tTransitionTime: "2019-12-20T05:39:37Z"
      status: "True"
      type: ExperimentCompleted

    # ExperimentSucceeded indicates whether the experiment succeeded or not when it is completed
    - lastTransitionTime: "2019-12-20T05:39:37Z"
      message: Aborted
      reason: ExperimentFailed
      status: "False"
      type: ExperimentSucceeded

    # MetricsSynced states whether the referenced metrics have been retrieved from the ConfigMap and stored in the metrics section
    - lastTransitionTime: "2019-12-20T05:38:22Z"
      status: "True"
      type: MetricsSynced

    # Ready records the status of the latest-updated condition
    - lastTransitionTime: "2019-12-20T05:39:37Z"
      message: Aborted
      reason: ExperimentFailed
      status: "False"
      type: Ready

    # RoutingRulesReady indicates whether the routing rules are successfully created/updated
    - lastTransitionTime: "2019-12-20T05:38:22Z"
      tatus: "True"
      type: RoutingRulesReady

    # TargetsProvided is "True" when both the baseline and the candidate versions of the targetService are detected by the controller; otherwise, missing elements will be shown in the reason field
    - lastTransitionTime: "2019-12-20T05:38:37Z"
      status: "True"
      type: TargetsProvided

    # the current experiment's iteration
    currentIteration: 2

    # Unix timestamp in milliseconds corresponding to when the experiment started
    startTimestamp: "1576820317351"

    # Unix timestamp in milliseconds corresponding to when the experiment finished
    endTimestamp: "1576820377696"

    # The url to he Grafana dashboard pertaining to this experiment
    grafanaURL: http://localhost:3000/d/eXPEaNnZz/iter8-application-metrics?var-namespace=bookinfo-iter8&var-service=reviews&var-baseline=reviews-v3&var-candidate=reviews-v5&from=1576820317351&to=1576820377696

    # the time when the previous iteration was completed
    lastIncrementTime: "2019-12-20T05:39:07Z"

    # this is the message to be shown in the STATUS column for the `kubectl` printer, which summarizes the experiment situation
    message: 'ExperimentFailed: Aborted'

    # the experiment's current phase
    # values could be: Initializing, Progressing, Pause, Completed
    phase: Completed

    # the current traffic split
    trafficSplitPercentage:
      baseline: 100
      candidate: 0
*/
type Iter8ExperimentStatus struct {
	AnalysisState map[string]interface{} `json:"analysisState"`
	Assestment    struct {
		Conclusions []string `json:"conclusions"`
	} `json:"assessment"`
	Conditions []struct {
		LastTransitionTime string `json:"lastTransitionTime"`
		Message            string `json:"message"`
		Reason             string `json:"reason"`
		Status             string `json:"status"`
		Type               string `json:"type"`
	} `json:"conditions"`
	CurrentIteration       int    `json:"currentIteration"`
	StartTimeStamp         string `json:"startTimestamp"`
	EndTimestamp           string `json:"endTimestamp"`
	GrafanaURL             string `json:"grafanaURL"`
	LastIncrementTime      string `json:"lastIncrementTime"`
	Message                string `json:"message"`
	Phase                  string `json:"phase"`
	TrafficSplitPercentage struct {
		Baseline  int `json:"baseline"`
		Candidate int `json:"candidate"`
	} `json:"trafficSplitPercentage"`
}

// Iter8Experiment is a dynamic object to map Iter8 Experiments
type Iter8Experiment interface {
	runtime.Object
	GetSpec() Iter8ExperimentSpec
	SetSpec(Iter8ExperimentSpec)
	GetMetrics() Iter8ExperimentMetrics
	SetMetrics(Iter8ExperimentMetrics)
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

type Iter8ExperimentObject struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata"`
	Spec               Iter8ExperimentSpec    `json:"spec"`
	Metrics            Iter8ExperimentMetrics `json:"metrics"`
	Status             Iter8ExperimentStatus  `json:"status"`
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

type Iter8ClientInterface interface {
	CreateIter8Experiment(namespace string, json string) (Iter8Experiment, error)
	GetIter8Experiment(namespace string, name string) (Iter8Experiment, error)
	GetIter8Experiments(namespace string) ([]Iter8Experiment, error)
	IsIter8Api() bool
}

func (in *IstioClient) IsIter8Api() bool {
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

func (in *IstioClient) CreateIter8Experiment(namespace string, json string) (Iter8Experiment, error) {
	var result runtime.Object
	var err error
	byteJson := []byte(json)
	result, err = in.iter8Api.Post().Namespace(namespace).Resource(iter8experiments).Body(byteJson).Do().Get()
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

func (in *IstioClient) GetIter8Experiment(namespace string, name string) (Iter8Experiment, error) {
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(iter8experiments).SubResource(name).Do().Get()
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

func (in *IstioClient) GetIter8Experiments(namespace string) ([]Iter8Experiment, error) {
	result, err := in.iter8Api.Get().Namespace(namespace).Resource(iter8experiments).Do().Get()
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
