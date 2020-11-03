package business

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"gopkg.in/yaml.v2"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/status"
)

type Iter8Service struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

func (in *Iter8Service) GetIter8Info() models.Iter8Info {
	var err error
	var ps []core_v1.Pod
	var controllerImgVersion string
	var analyticsImgVersion string
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Info")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()

	// It will be considered enabled if the extension is present in the Kiali configuration and the CRD is enabled on the cluster
	if conf.Extensions.Iter8.Enabled && in.k8s.IsIter8Api() {
		if IsNamespaceCached(conf.Extensions.Iter8.Namespace) {
			ps, err = kialiCache.GetPods(conf.Extensions.Iter8.Namespace, "")
		} else {
			ps, err = in.k8s.GetPods(conf.Extensions.Iter8.Namespace, "")
		}
		if err == nil {
			pods := models.Pods{}
			pods.Parse(ps)
			reg, _ := regexp.Compile("[a-zA-Z]+")
			for _, pod := range pods {
				for _, ct := range pod.Containers {
					imgInfo := strings.Split(ct.Image, ":")
					if strings.Contains(imgInfo[0], "iter8-controller") {
						controllerImgVersion = reg.ReplaceAllString(imgInfo[1], "")
					} else if strings.Contains(imgInfo[0], "iter8-analytics") {
						analyticsImgVersion = reg.ReplaceAllString(imgInfo[1], "")
					}
				}
			}
		} else {
			// Configuration error, cannot find iter8 controller and analytics in the namespace specified
			return models.Iter8Info{
				Enabled:                false,
				SupportedVersion:       false,
				ControllerImageVersion: controllerImgVersion,
				AnalyticsImageVersion:  analyticsImgVersion,
			}
		}

		supportedVersion := true
		if controllerImgVersion != "" && analyticsImgVersion != "" {
			if !status.IsIter8Supported(analyticsImgVersion) {
				supportedVersion = false
			}

			if !status.IsIter8Supported(analyticsImgVersion) {
				supportedVersion = false
			}
		}

		return models.Iter8Info{
			Enabled:                true,
			SupportedVersion:       supportedVersion,
			ControllerImageVersion: controllerImgVersion,
			AnalyticsImageVersion:  analyticsImgVersion,
		}
	}
	return models.Iter8Info{
		Enabled:                false,
		SupportedVersion:       false,
		ControllerImageVersion: controllerImgVersion,
		AnalyticsImageVersion:  analyticsImgVersion,
	}
}

func (in *Iter8Service) GetIter8Experiment(namespace string, name string) (models.Iter8ExperimentDetail, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Experiment")
	defer promtimer.ObserveNow(&err)

	iter8ExperimentDetail := models.Iter8ExperimentDetail{}

	errChan := make(chan error, 2)
	var wg sync.WaitGroup
	wg.Add(2)

	var iter8ExperimentObject kubernetes.Iter8Experiment
	var canCreate, canUpdate, canDelete bool

	go func(errChan chan error) {
		defer wg.Done()
		var gErr error
		iter8ExperimentObject, gErr = in.k8s.GetIter8Experiment(namespace, name)
		if gErr == nil {
			iter8ExperimentDetail.Parse(iter8ExperimentObject)
		} else {
			errChan <- gErr
		}

	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		canCreate, canUpdate, canDelete = getPermissions(in.k8s, namespace, kubernetes.Iter8Experiments)
	}(errChan)

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return iter8ExperimentDetail, err
	}

	iter8ExperimentDetail.Permissions.Create = canCreate
	iter8ExperimentDetail.Permissions.Update = canUpdate
	iter8ExperimentDetail.Permissions.Delete = canDelete

	return iter8ExperimentDetail, nil
}
func (in *Iter8Service) GetIter8ExperimentYaml(namespace string, name string) (kubernetes.Iter8ExperimentCRD, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "UpdateIter8Experiment")
	defer promtimer.ObserveNow(&err)
	Iter8ExperimentCRD := kubernetes.Iter8ExperimentCRD{}
	iter8ExperimentObject, gErr := in.k8s.GetIter8Experiment(namespace, name)
	if gErr == nil {
		Iter8ExperimentCRD.Spec = iter8ExperimentObject.GetSpec()
		Iter8ExperimentCRD.Spec.ManualOverride = nil
		objectMeta := iter8ExperimentObject.GetObjectMeta()
		Iter8ExperimentCRD.ObjectMeta.Name = objectMeta.Name
		Iter8ExperimentCRD.ObjectMeta.Labels = objectMeta.Labels
		Iter8ExperimentCRD.ObjectMeta.Namespace = objectMeta.Namespace
		Iter8ExperimentCRD.Spec.Metrics = struct {
			CounterMetrics []kubernetes.CounterMetric `json:"counter_metrics,omitempty"`
			RatioMetrics   []kubernetes.RatioMetric   `json:"ratio_metrics,omitempty"`
		}{}
		Iter8ExperimentCRD.APIVersion = "iter8.tools/v1alpha2"
		Iter8ExperimentCRD.Kind = "Experiment"
	}

	return Iter8ExperimentCRD, gErr
}

func (in *Iter8Service) GetIter8ExperimentsByNamespace(namespace string) ([]models.Iter8ExperimentItem, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8ExperimentsByNamespace")
	defer promtimer.ObserveNow(&err)

	return in.fetchIter8Experiments(namespace)
}

func (in *Iter8Service) GetIter8Experiments(namespaces []string) ([]models.Iter8ExperimentItem, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Experiments")
	defer promtimer.ObserveNow(&err)

	experiments := make([]models.Iter8ExperimentItem, 0)
	if len(namespaces) == 0 {
		allNamespaces, _ := in.businessLayer.Namespace.GetNamespaces()
		for _, namespace := range allNamespaces {
			namespaces = append(namespaces, namespace.Name)
		}
	}
	for _, namespace := range namespaces {
		experimentsOfNamespace, err := in.fetchIter8Experiments(namespace)
		if err == nil {
			experiments = append(experiments, experimentsOfNamespace...)
		}
	}
	return experiments, nil
}

func (in *Iter8Service) fetchIter8Experiments(namespace string) ([]models.Iter8ExperimentItem, error) {
	iter8ExperimentObjects, err := in.k8s.GetIter8Experiments(namespace)
	if err != nil {
		return []models.Iter8ExperimentItem{}, err
	}
	experiments := make([]models.Iter8ExperimentItem, 0)
	for _, iter8ExperimentObject := range iter8ExperimentObjects {
		iter8ExperimentItem := models.Iter8ExperimentItem{}
		iter8ExperimentItem.Parse(iter8ExperimentObject)
		experiments = append(experiments, iter8ExperimentItem)
	}
	return experiments, nil
}

func (in *Iter8Service) CreateIter8Experiment(namespace string, body []byte, jsonBody bool) (models.Iter8ExperimentDetail, error) {
	var err error
	var jsonByte string
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "CreateIter8Experiment")
	defer promtimer.ObserveNow(&err)
	iter8ExperimentDetail := models.Iter8ExperimentDetail{}

	if !jsonBody {
		jsonByte, err = in.ParseJsonForCreate(body)
	} else {
		jsonByte = string(body)
	}

	iter8ExperimentObject, err := in.k8s.CreateIter8Experiment(namespace, jsonByte)
	if err != nil {
		return iter8ExperimentDetail, err
	}

	iter8ExperimentDetail.Parse(iter8ExperimentObject)
	return iter8ExperimentDetail, nil
}

func (in *Iter8Service) UpdateIter8Experiment(namespace string, name string, body []byte) (models.Iter8ExperimentDetail, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "UpdateIter8Experiment")
	defer promtimer.ObserveNow(&err)

	iter8ExperimentDetail := models.Iter8ExperimentDetail{}
	action := models.Iter8ExperimentAction{}
	err = json.Unmarshal(body, &action)
	if err != nil {
		return iter8ExperimentDetail, err
	}
	experiment, err := in.GetIter8Experiment(namespace, name)
	newExperimentSpec := models.Iter8ExperimentSpec{}
	newExperimentSpec.Parse(experiment)
	m := make(map[string]int32)
	for _, s := range action.TrafficSplit {
		x, err := strconv.ParseInt(s[1], 10, 64)
		if err == nil {
			m[s[0]] = int32(x)
		}
	}

	newAction := kubernetes.ExperimentAction{
		Action:       action.Action,
		TrafficSplit: m,
	}
	newExperimentSpec.Action = &newAction

	var newObject []byte
	newObject, err = json.Marshal(newExperimentSpec)
	jsonByte, err := in.ParseJsonForCreate(newObject)
	if err != nil {
		return iter8ExperimentDetail, err
	}

	iter8ExperimentObject, err := in.k8s.UpdateIter8Experiment(namespace, name, jsonByte)
	if err != nil {
		return iter8ExperimentDetail, err
	}

	iter8ExperimentDetail.Parse(iter8ExperimentObject)
	return iter8ExperimentDetail, nil
}

func (in *Iter8Service) ParseJsonForCreate(body []byte) (string, error) {
	newExperimentSpec := models.Iter8ExperimentSpec{}
	err := json.Unmarshal(body, &newExperimentSpec)
	if err != nil {
		return "", err
	}
	object := kubernetes.Iter8ExperimentObject{
		TypeMeta: v1.TypeMeta{
			APIVersion: kubernetes.Iter8GroupVersion.String(),
			Kind:       "Experiment",
		},
		ObjectMeta: v1.ObjectMeta{
			Name: newExperimentSpec.Name,
		},
		Spec:   kubernetes.Iter8ExperimentSpec{},
		Status: kubernetes.Iter8ExperimentStatus{},
	}
	object.Spec.Service.APIVersion = "v1"
	object.Spec.Service.Name = newExperimentSpec.Service
	object.Spec.Service.Baseline = newExperimentSpec.Baseline
	object.Spec.Service.Candidates = newExperimentSpec.Candidates
	if newExperimentSpec.ExperimentKind == "" {
		object.Spec.Service.Kind = "Deployment"
	} else {
		object.Spec.Service.Kind = newExperimentSpec.ExperimentKind
	}
	object.Spec.Duration.Interval = newExperimentSpec.Duration.Interval
	object.Spec.Duration.MaxIterations = newExperimentSpec.Duration.MaxIterations
	object.Spec.TrafficControl.Strategy = newExperimentSpec.TrafficControl.Strategy
	object.Spec.TrafficControl.MaxIncrement = newExperimentSpec.TrafficControl.MaxIncrement
	object.Spec.TrafficControl.OnTermination = newExperimentSpec.TrafficControl.OnTermination
	object.Spec.TrafficControl.Percentage = newExperimentSpec.TrafficControl.Percentage
	object.Spec.TrafficControl.Match.HTTP = in.ParseMatchRule(newExperimentSpec.TrafficControl.Match.HTTP)

	if newExperimentSpec.Hosts != nil || newExperimentSpec.RoutingID != "" {
		hosts := make([]kubernetes.Iter8Host, len(newExperimentSpec.Hosts))
		for i, host := range newExperimentSpec.Hosts {
			hosts[i] =
				kubernetes.Iter8Host{
					Name:    host.Name,
					Gateway: host.Gateway,
				}
		}
		networking := kubernetes.Iter8Networking{
			ID:    newExperimentSpec.RoutingID,
			Hosts: hosts,
		}
		object.Spec.Networking = &networking
	}

	for _, criteria := range newExperimentSpec.Criterias {

		if criteria.Tolerance != 0 {
			threshold := kubernetes.Iter8Threshold{
				Type:                     criteria.ToleranceType,
				Value:                    criteria.Tolerance,
				CutoffTrafficOnViolation: criteria.StopOnFailure,
			}

			object.Spec.Criteria = append(object.Spec.Criteria,
				struct {
					Metric    string                     `json:"metric"`
					Threshold *kubernetes.Iter8Threshold `json:"threshold,omitempty"`
					IsReward  bool                       `json:"isReward,omitempty"`
				}{
					Metric:    criteria.Metric,
					Threshold: &threshold,
					IsReward:  criteria.IsReward,
				})
		} else {
			object.Spec.Criteria = append(object.Spec.Criteria,
				struct {
					Metric    string                     `json:"metric"`
					Threshold *kubernetes.Iter8Threshold `json:"threshold,omitempty"`
					IsReward  bool                       `json:"isReward,omitempty"`
				}{
					Metric:   criteria.Metric,
					IsReward: criteria.IsReward,
				})
		}

	}

	if newExperimentSpec.Action != nil {
		object.Spec.ManualOverride = newExperimentSpec.Action
	}
	b, err2 := json.Marshal(object)
	if err2 != nil {
		return "", err2
	}
	return string(b), nil
}

func (in *Iter8Service) buildStringMatch(mr models.HTTPMatchRule) *kubernetes.StringMatch {
	uri := kubernetes.StringMatch{}
	stringMatch := mr.StringMatch
	switch mr.Match {
	case "exact":
		uri.Exact = &stringMatch
	case "prefix":
		uri.Prefix = &stringMatch
	case "regex":
		uri.Regex = &stringMatch
	}
	return &uri
}

func (in *Iter8Service) ParseMatchRule(http []models.HTTPMatchRequest) []*kubernetes.HTTPMatchRequest {

	var ptr = make([]*kubernetes.HTTPMatchRequest, len(http))
	// var ptr [numOfEntries]*kubernetes.HTTPMatchRequest;
	for i, m := range http {
		nm := kubernetes.HTTPMatchRequest{}

		if (m.URI != models.HTTPMatchRule{}) {
			nm.URI = in.buildStringMatch(m.URI) // &uri
		}
		if len(m.Headers) > 0 {
			nm.Headers = make(map[string]*kubernetes.StringMatch)
			for _, h := range m.Headers {
				key := h.Key
				nm.Headers[key] = in.buildStringMatch(h) // &header
			}
		}

		ptr[i] = &nm
	}
	return ptr
}

func (in *Iter8Service) DeleteIter8Experiment(namespace string, name string) (err error) {
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "DeleteIter8Experiment")
	defer promtimer.ObserveNow(&err)

	err = in.k8s.DeleteIter8Experiment(namespace, name)
	return err
}

func (in *Iter8Service) GetIter8Metrics() (metricNames []string, err error) {
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Metrics")
	defer promtimer.ObserveNow(&err)

	metricNames, err = in.k8s.Iter8MetricMap()
	return metricNames, err
}

func (in *Iter8Service) GetAnalyticPort() int {
	conf := config.Get()
	configMap, err := in.k8s.GetConfigMap(conf.Extensions.Iter8.Namespace, "iter8-analytics")
	if err != nil {
		return 80
	}
	configYaml, ok := configMap.Data["config.yaml"]
	if !ok {
		return 80
	}
	analyticConfig := models.Iter8AnalyticsConfig{}
	err = yaml.Unmarshal([]byte(configYaml), &analyticConfig)
	if err != nil {
		return 80
	}
	return analyticConfig.Port
}
