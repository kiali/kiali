package workloadgroups

import (
	"fmt"

	"github.com/kiali/kiali/models"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
)

type ServiceAccountsChecker struct {
	WorkloadGroup   *networking_v1.WorkloadGroup
	Cluster         string
	ServiceAccounts map[string][]string
}

func (sac ServiceAccountsChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true
	if sac.WorkloadGroup.Spec.Template.ServiceAccount != "" {
		if !sac.hasMatchingServiceAccount(sac.ServiceAccounts[sac.Cluster], sac.WorkloadGroup.Namespace, sac.WorkloadGroup.Spec.Template.ServiceAccount) {
			path := "spec/template/serviceAccount"
			valid = false
			validation := models.Build("workloadgroup.template.serviceaccount.notfound", path)
			checks = append(checks, &validation)
		}
	}
	return checks, valid
}

func (sac ServiceAccountsChecker) hasMatchingServiceAccount(serviceAccounts []string, namespace, serviceAccount string) bool {
	for _, sa := range serviceAccounts {
		if sa == fmt.Sprintf("cluster.local/ns/%s/sa/%s", namespace, serviceAccount) {
			return true
		}
	}

	return false
}
