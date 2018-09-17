package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"k8s.io/apimachinery/pkg/labels"
)

// Workload deals with fetching istio/kubernetes workloads related content and convert to kiali model
type WorkloadService struct {
	k8s kubernetes.IstioClientInterface
}

// GetWorkloadList is the API handler to fetch the list of workloads in a given namespace
func (in *WorkloadService) GetWorkloadList(namespace string) (models.WorkloadList, error) {
	ds, err := in.k8s.GetDeployments(namespace, "")
	if err != nil {
		return models.WorkloadList{}, err
	}

	workloadList := &models.WorkloadList{}
	workloadList.Namespace.Name = namespace
	for _, deployment := range ds {
		selector := labels.FormatLabels(deployment.Spec.Template.Labels)
		dPods, _ := in.k8s.GetPods(namespace, selector)

		cast := &models.WorkloadListItem{}
		cast.Parse(deployment)

		mPods := models.Pods{}
		mPods.Parse(dPods)
		cast.IstioSidecar = mPods.HasIstioSideCar()

		(*workloadList).Workloads = append((*workloadList).Workloads, *cast)
	}
	return *workloadList, nil
}

// GetWorkload is the API handler to fetch details of a specific workload.
// If includeServices is set true, the Workload will fetch all services related
func (in *WorkloadService) GetWorkload(namespace string, workloadName string, includeServices bool) (*models.Workload, error) {
	model := &models.Workload{}

	deployment, err := in.k8s.GetDeployment(namespace, workloadName)
	if deployment == nil || err != nil {
		return nil, err
	}
	model.Parse(deployment)

	selector := labels.FormatLabels(deployment.Spec.Template.Labels)
	pods, err := in.k8s.GetPods(namespace, selector)
	if err != nil {
		return nil, err
	}
	model.SetPods(pods)

	if includeServices {
		services, err := in.k8s.GetServices(namespace, deployment.Spec.Template.Labels)
		if err != nil {
			return nil, err
		}
		model.SetServices(services)
	}

	return model, nil
}

func (in *WorkloadService) GetPods(namespace string, labelSelector string) (models.Pods, error) {
	ps, err := in.k8s.GetPods(namespace, labelSelector)
	if err != nil {
		return nil, err
	}
	pods := models.Pods{}
	pods.Parse(ps)
	return pods, nil
}
