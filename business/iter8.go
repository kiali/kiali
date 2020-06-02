package business

import (
	"encoding/json"
	"gopkg.in/yaml.v2"

	"sort"
	"strconv"
	"sync"

	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type Iter8Service struct {
	k8s           kubernetes.IstioClientInterface
	businessLayer *Layer
}

func (in *Iter8Service) GetIter8Info() models.Iter8Info {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Info")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()

	// It will be considered enabled if the extension is present in the Kiali configuration and the CRD is enabled on the cluster
	if conf.Extensions.Iter8.Enabled && in.k8s.IsIter8Api() {
		return models.Iter8Info{
			Enabled: true,
		}
	}
	return models.Iter8Info{
		Enabled: false,
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
		canCreate, canUpdate, canDelete = getPermissions(in.k8s, namespace, Experiments, "")
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
	// get RoutingReference
	newExperimentSpec := models.Iter8ExperimentSpec{}
	err = json.Unmarshal(body, &newExperimentSpec)
	if err != nil {
		return iter8ExperimentDetail, err
	}
	rr, _ := in.GetIter8RoutingReferences(namespace, newExperimentSpec.Service)

	json, err := in.ParseJsonForCreate(body, rr)

	iter8ExperimentObject, err := in.k8s.CreateIter8Experiment(namespace, json)
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
	// get RoutingReference
	rr, _ := in.GetIter8RoutingReferences(newExperimentSpec.Namespace, newExperimentSpec.Service)

	var newObject []byte
	newObject, err = json.Marshal(newExperimentSpec)
	json, err := in.ParseJsonForCreate(newObject, rr)
	if err != nil {
		return iter8ExperimentDetail, err
	}

	iter8ExperimentObject, err := in.k8s.UpdateIter8Experiment(namespace, name, string(json))
	if err != nil {
		return iter8ExperimentDetail, err
	}

	iter8ExperimentDetail.Parse(iter8ExperimentObject)
	return iter8ExperimentDetail, nil
}

func (in *Iter8Service) ParseJsonForCreate(body []byte, rr []models.RoutingReference) (string, error) {

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
	object.Spec.TrafficControl.Strategy = newExperimentSpec.TrafficControl.Algorithm
	object.Spec.TrafficControl.MaxTrafficPercentage = newExperimentSpec.TrafficControl.MaxTrafficPercentage
	object.Spec.TrafficControl.MaxIterations = newExperimentSpec.TrafficControl.MaxIterations
	object.Spec.TrafficControl.TrafficStepSize = newExperimentSpec.TrafficControl.TrafficStepSize
	object.Spec.TrafficControl.Interval = newExperimentSpec.TrafficControl.Interval
	object.Spec.Analysis.AnalyticsService = "http://iter8-analytics.iter8:" + strconv.Itoa(in.GetAnalyticPort())
	if len(rr) == 1 {
		rrptr := core_v1.ObjectReference{
			Name:       rr[0].Name,
			APIVersion: rr[0].ApiVersion,
			Kind:       rr[0].Kind,
		}
		object.Spec.RoutingReference = &rrptr
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
	configMap, err := in.k8s.GetConfigMap("iter8", "iter8-analytics")
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

func (in *Iter8Service) GetIter8RoutingReferences(namespace string, servicename string) (routingReferences []models.RoutingReference, err error) {
	promtimer := internalmetrics.GetGoFunctionMetric("business", "Iter8Service", "GetIter8Metrics")
	defer promtimer.ObserveNow(&err)
	istioCfg, err := in.businessLayer.IstioConfig.GetIstioConfigList(IstioConfigCriteria{
		IncludeGateways:        true,
		IncludeVirtualServices: true,
		Namespace:              namespace,
	})

	routingReferences = make([]models.RoutingReference, 0)
	gwNames := make([]string, 0)

	for _, gw := range istioCfg.Gateways {
		gwNames = append(gwNames, gw.Metadata.Name)
	}

	for _, item := range istioCfg.VirtualServices.Items {
		docheck := false
		if item.IsValidHost(namespace, servicename) {
			gws := item.Spec.Gateways
			rf := models.RoutingReference{}
			if gateways, ok := gws.([]interface{}); ok {
				for _, g := range gateways {
					if gate, ok := g.(string); ok {
						if contains(gwNames, gate) {

							rf.ApiVersion = item.APIVersion
							rf.Name = item.Metadata.Name
							rf.Kind = item.Kind

							docheck = true
						}
					}
				}
			}
			if docheck {
				proto := item.Spec.Http
				if aHttp, ok := proto.([]interface{}); ok {
					for _, httpRoute := range aHttp {
						if mHttpRoute, ok := httpRoute.(map[string]interface{}); ok {
							if route, ok := mHttpRoute["route"]; ok {
								if aDestinationWeight, ok := route.([]interface{}); ok {
									for _, destination := range aDestinationWeight {
										host := parseHost(destination)
										if host == "" {
											continue
										} else if host == servicename {
											routingReferences = append(routingReferences, rf)
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return routingReferences, err
}

func contains(s []string, searchterm string) bool {
	i := sort.SearchStrings(s, searchterm)
	return i < len(s) && s[i] == searchterm
}

func parseHost(destination interface{}) string {
	if mDestination, ok := destination.(map[string]interface{}); ok {
		if destinationW, ok := mDestination["destination"]; ok {
			if mDestinationW, ok := destinationW.(map[string]interface{}); ok {
				if host, ok := mDestinationW["host"]; ok {
					if sHost, ok := host.(string); ok {
						return sHost
					}
				}
			}
		}
	}
	return ""
}
