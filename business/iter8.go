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
		if kialiCache != nil && kialiCache.CheckNamespace(conf.Extensions.Iter8.Namespace) {
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

func (in *Iter8Service) CreateIter8Experiment(namespace string, body []byte) (models.Iter8ExperimentDetail, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "CreateIter8Experiment")
	defer promtimer.ObserveNow(&err)

	iter8ExperimentDetail := models.Iter8ExperimentDetail{}

	jsonByte, err := in.ParseJsonForCreate(body)

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
	action := models.ExperimentAction{}
	err = json.Unmarshal(body, &action)
	if err != nil {
		return iter8ExperimentDetail, err
	}
	experiment, err := in.GetIter8Experiment(namespace, name)
	newExperimentSpec := models.Iter8ExperimentSpec{}
	newExperimentSpec.Parse(experiment)
	newExperimentSpec.Action = action.Action

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
		Spec:    kubernetes.Iter8ExperimentSpec{},
		Metrics: kubernetes.Iter8ExperimentMetrics{},
		Status:  kubernetes.Iter8ExperimentStatus{},
	}
	object.Spec.TargetService.ApiVersion = "v1"
	object.Spec.TargetService.Name = newExperimentSpec.Service
	object.Spec.TargetService.Baseline = newExperimentSpec.Baseline
	object.Spec.TargetService.Candidate = newExperimentSpec.Candidate
	if newExperimentSpec.ExperimentKind == "" {
		object.Spec.TargetService.Kind = "Deployment"
	} else {
		object.Spec.TargetService.Kind = newExperimentSpec.ExperimentKind
	}

	object.Spec.TrafficControl.Strategy = newExperimentSpec.TrafficControl.Algorithm
	object.Spec.TrafficControl.MaxTrafficPercentage = newExperimentSpec.TrafficControl.MaxTrafficPercentage
	object.Spec.TrafficControl.MaxIterations = newExperimentSpec.TrafficControl.MaxIterations
	object.Spec.TrafficControl.TrafficStepSize = newExperimentSpec.TrafficControl.TrafficStepSize
	object.Spec.TrafficControl.Interval = newExperimentSpec.TrafficControl.Interval
	object.Spec.Analysis.AnalyticsService = "http://iter8-analytics.iter8:" + strconv.Itoa(in.GetAnalyticPort())

	for _, host := range newExperimentSpec.Hosts {
		object.Spec.TargetService.Hosts = append(object.Spec.TargetService.Hosts,
			struct {
				Name    string `json:"name"`
				Gateway string `json:"gateway"`
			}{
				Name:    host.Name,
				Gateway: host.Gateway,
			})
	}
	for _, criteria := range newExperimentSpec.Criterias {
		min_max := struct {
			Min float64 `json:"min,omitempty"`
			Max float64 `json:"max,omitempty"`
		}{
			Min: 0.1,
			Max: 1.0,
		}
		object.Spec.Analysis.SuccessCriteria = append(object.Spec.Analysis.SuccessCriteria,
			struct {
				MetricName    string  `json:"metricName,omitempty"`
				ToleranceType string  `json:"toleranceType,omitempty"`
				Tolerance     float64 `json:"tolerance,omitempty"`
				SampleSize    int     `json:"sampleSize,omitempty"`
				MinMax        struct {
					Min float64 `json:"min,omitempty"`
					Max float64 `json:"max,omitempty"`
				} `json:"min_max,omitempty"`
				StopOnFailure bool `json:"stopOnFailure,omitempty"`
			}{
				MetricName:    criteria.Metric,
				ToleranceType: criteria.ToleranceType,
				Tolerance:     criteria.Tolerance,
				SampleSize:    criteria.SampleSize,
				StopOnFailure: criteria.StopOnFailure,
				MinMax:        min_max,
			})
	}
	if len(object.Spec.Analysis.SuccessCriteria) == 0 {
		min_max := struct {
			Min float64 `json:"min,omitempty"`
			Max float64 `json:"max,omitempty"`
		}{
			Min: 0.1,
			Max: 1.0,
		}
		object.Spec.Analysis.SuccessCriteria = append(object.Spec.Analysis.SuccessCriteria,
			struct {
				MetricName    string  `json:"metricName,omitempty"`
				ToleranceType string  `json:"toleranceType,omitempty"`
				Tolerance     float64 `json:"tolerance,omitempty"`
				SampleSize    int     `json:"sampleSize,omitempty"`
				MinMax        struct {
					Min float64 `json:"min,omitempty"`
					Max float64 `json:"max,omitempty"`
				} `json:"min_max,omitempty"`
				StopOnFailure bool `json:"stopOnFailure,omitempty"`
			}{
				MetricName:    "iter8_latency",
				ToleranceType: "threshold",
				Tolerance:     200,
				SampleSize:    5,
				StopOnFailure: false,
				MinMax:        min_max,
			})
	}
	if newExperimentSpec.Action != "" {
		object.Action = kubernetes.Iter8ExperimentAction(newExperimentSpec.Action)
	}

	b, err2 := json.Marshal(object)
	if err2 != nil {
		return "", err2
	}
	return string(b), nil
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

	metricNames, err = in.k8s.Iter8ConfigMap()
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
