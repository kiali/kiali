package business

import (
	"encoding/json"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"k8s.io/apimachinery/pkg/runtime/schema"
	kube "k8s.io/client-go/kubernetes"
	"github.com/kiali/kiali/config"
	"k8s.io/client-go/rest"
	"time"
	"fmt"
	"github.com/kiali/kiali/log"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	corev1 "k8s.io/api/core/v1"
	iter8v1alpha1 "github.com/iter8-tools/iter8-controller/pkg/apis/iter8/v1alpha1"
	kialiConfig "github.com/kiali/kiali/config"
)

const GroupName = "iter8.tools"
const GroupVersion = "v1alpha1"

type Iter8Service struct {
	k8s kubernetes.IstioClientInterface
	businessLayer *Layer
}

func (in *Iter8Service) GetIter8Info() (models.Iter8Info, error) {

	var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: GroupVersion}
	var iter8Kind = SchemeGroupVersion.WithKind("Experiment")

	if (iter8Kind == schema.GroupVersionKind{}) {
		return models.Iter8Info{}, nil
	}
	log.Infof("Experiment CRD exists")
	return models.Iter8Info{
		Enabled: true,
	}, nil
}

func (in *Iter8Service) GetIter8Experiment(namespace string, name string) (experiment models.ExperimentDetail, err error) {
	result := &iter8v1alpha1.Experiment{}
	cacheToken := ""
	kConfig := kialiConfig.Get()
	if kConfig.InCluster {
		if saToken, err := kubernetes.GetKialiToken(); err != nil {
			return models.ExperimentDetail{}, err
		} else {
			cacheToken = saToken
		}
	}
	config, err := kubernetes.ConfigClient()
	if err != nil {
		return models.ExperimentDetail{}, err
	}
	istioConfig := rest.Config{
		Host:            config.Host,
		TLSClientConfig: config.TLSClientConfig,
		QPS:             config.QPS,
		BearerToken:     cacheToken,
		Burst:           config.Burst,
	}

	istioClient, err := kubernetes.NewClientFromConfig(&istioConfig)
	clientset := istioClient.GetK8sApi()
	path := fmt.Sprintf("/apis/iter8.tools/v1alpha1/")
	err = clientset.CoreV1().RESTClient().Get().AbsPath(path).
		Namespace(namespace).
		Resource("experiments").
		Name(name).
		Do().Into(result)

	criterias := make([]models.CriteriaDetail, len(result.Spec.Analysis.SuccessCriteria))
	for i, c := range result.Spec.Analysis.SuccessCriteria {
		metricName := c.MetricName
		criteriaDetail := models.CriteriaDetail {
			Name: c.MetricName,
			Criteria : models.Criteria {
				Metric : c.MetricName,
				SampleSize : c.GetSampleSize(),
				Tolerance : c.Tolerance,
				ToleranceType : string(c.ToleranceType),
				StopOnFailure:c.GetStopOnFailure(),
			},
			Metric: models.Metric {
				AbsentValue: result.Metrics[metricName].AbsentValue,
				IsCounter: result.Metrics[metricName].IsCounter,
				QueryTemplate: result.Metrics[metricName].QueryTemplate,
				SampleSizeTemplate: result.Metrics[metricName].SampleSizeTemplate,
			},
		}
		criterias[i] = criteriaDetail
	}
    trafficControl :=  models.TrafficControl {
    	Algorithm : result.Spec.TrafficControl.GetStrategy(),
    	Interval: result.Spec.TrafficControl.GetInterval(),
    	MaxIteration : result.Spec.TrafficControl.GetMaxIterations(),
    	MaxTrafficPercentage: result.Spec.TrafficControl.GetMaxTrafficPercentage(),
    	TrafficStepSize: result.Spec.TrafficControl.GetStepSize(),
    }
	return models.ExperimentDetail{
		ExperimentItem : models.ExperimentListItem {
			Name: result.Name,
			Status: result.Status.Message,
			Baseline: result.Spec.TargetService.Baseline,
			BaselinePercentage: result.Status.TrafficSplit.Baseline,
			Candidate: result.Spec.TargetService.Candidate,
			CandidatePercentage: result.Status.TrafficSplit.Candidate,
		},
		CriteriaDetails: criterias,
		TrafficControl: trafficControl,

	}, nil
}

func (in *Iter8Service) GetIter8Experiments(namespaces []string) ( []models.ExperimentListItem, error) {
	experiments := make([]models.ExperimentListItem, 0)
	if (len(namespaces) == 0) {
		allNamespaces, _ := in.businessLayer.Namespace.GetNamespaces()
		for _, namespace := range allNamespaces {
			namespaces = append (namespaces, namespace.Name)
		}
	}

	log.Info("there are %d Namespace", len(namespaces))

	for _, namespace := range namespaces {
		experimentsOfNamespace, err := getExperimentsByNamespace(namespace)
		if err == nil {
			for _, item := range experimentsOfNamespace {
				experiments = append (experiments, item)
			}

		}

	}

	return experiments, nil
}
func (in *Iter8Service) GetIter8ExperimentsByName(namespace string) (experiment []models.ExperimentListItem, err error) {
	return getExperimentsByNamespace(namespace)
}

func getExperimentsByNamespace(namespace string) (experiment []models.ExperimentListItem, err error) {
	experiments := make([]models.ExperimentListItem, 0)
	result := &iter8v1alpha1.ExperimentList{}
	k8sConfig, err := kubernetes.ConfigClient()
	if err != nil {
		return experiments, err
		// return models.ExperimentList{}, err
	}

	cacheToken := ""
	kConfig := kialiConfig.Get()
	if kConfig.InCluster {
		if saToken, err := kubernetes.GetKialiToken(); err != nil {
			return experiments, err
			// return models.ExperimentList{}, err
		} else {
			cacheToken = saToken
		}
	}
	log.Infof("Found token len %d", len(cacheToken))
		k8sConfig.QPS = config.Get().KubernetesConfig.QPS
		k8sConfig.Burst = config.Get().KubernetesConfig.Burst
		k8sConfig.BearerToken = cacheToken
		k8s, err := kube.NewForConfig(k8sConfig)

	var timeout time.Duration
	path := fmt.Sprintf("/apis/iter8.tools/v1alpha1/")
	err = k8s.RESTClient().Get().AbsPath(path).
		Namespace(namespace).
		Resource("experiments").
		Timeout(timeout).
		Do().
		Into(result)
	log.Infof("Get Experiments return error %s", err)
	log.Infof("Finding experiment for namespace %s", namespace)
	log.Infof("Received result lenght %d", len(result.Items))
	for _, item := range result.Items {

		experiments  = append (experiments,  models.ExperimentListItem{
			Name: item.Name,
			Phase: string(item.Status.Phase),
			Status: item.Status.Message,
			CreatedAt: formatTime(item.CreationTimestamp.Time),
			Baseline: item.Spec.TargetService.Baseline,
			BaselinePercentage: item.Status.TrafficSplit.Baseline,
			Candidate: item.Spec.TargetService.Candidate,
			CandidatePercentage: item.Status.TrafficSplit.Candidate,
			Namespace: namespace,
		})
	}
	return experiments, nil
}

func (in *Iter8Service) Iter8ExperimentCreate(body []byte) ( *iter8v1alpha1.Experiment, error){
	result := &iter8v1alpha1.Experiment{}
	k8sConfig, err := kubernetes.ConfigClient()
	if err != nil {
		return nil, err
		// return models.ExperimentList{}, err
	}

	cacheToken := ""
	kConfig := kialiConfig.Get()
	if kConfig.InCluster {
		if saToken, err := kubernetes.GetKialiToken(); err != nil {
			return nil,  err
			// return models.ExperimentList{}, err
		} else {
			cacheToken = saToken
		}
	}
	log.Infof("Found token len %d", len(cacheToken))
	k8sConfig.QPS = config.Get().KubernetesConfig.QPS
	k8sConfig.Burst = config.Get().KubernetesConfig.Burst
	k8sConfig.BearerToken = cacheToken
	k8s, err := kube.NewForConfig(k8sConfig)
	newexperimentSpec := &models.ExperimentSpec{}
	err2 := json.Unmarshal(body, newexperimentSpec)
	if err2 != nil {
		log.Errorf("JSON: %s shows error: %s", string(body), err2)
		err := fmt.Errorf("Bad Experiment json")
		return nil, err
	}
	experiment := iter8v1alpha1.Experiment {
		TypeMeta: metav1.TypeMeta {
			APIVersion: iter8v1alpha1.SchemeGroupVersion.String(),
			Kind: "Experiment",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      newexperimentSpec.Name,
			Namespace: newexperimentSpec.Namespace,
		},
		Spec: iter8v1alpha1.ExperimentSpec {
			TargetService: iter8v1alpha1.TargetService {
				ObjectReference: &corev1.ObjectReference {
					Name: newexperimentSpec.Service,
					Namespace: "bookinfo-iter8",
					APIVersion: "v1",
				},
				Baseline: newexperimentSpec.Baseline,
				Candidate: newexperimentSpec.Candidate,
			},

			TrafficControl: iter8v1alpha1.TrafficControl {
				Strategy: &newexperimentSpec.TrafficControl.Algorithm,
				MaxTrafficPercentage: &newexperimentSpec.TrafficControl.MaxTrafficPercentage,
				TrafficStepSize : &newexperimentSpec.TrafficControl.TrafficStepSize,
				Interval: &newexperimentSpec.TrafficControl.Interval,
				MaxIterations: &newexperimentSpec.TrafficControl.MaxIteration,
			},


		},
	}
	log.Infof("Ready to create %s", string(body))

	path := fmt.Sprintf("/apis/iter8.tools/v1alpha1/")
	var timeout time.Duration
	err = k8s.CoreV1().RESTClient().Post().AbsPath(path).
		Namespace(newexperimentSpec.Namespace).
		Resource("experiments").
		Body(&experiment).
		Timeout(timeout).
		Do().
		Into(result)
	if err != nil {
		log.Infof("Create return error %s", err)
	}
	return result, err
}

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}
