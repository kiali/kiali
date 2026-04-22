package workloadgroups

import (
	"fmt"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

type ServiceAccountsChecker struct {
	Cluster         string
	Conf            *config.Config
	IdentityDomain  string
	ServiceAccounts map[string][]string
	WorkloadGroup   *networking_v1.WorkloadGroup
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
	istioDomain := strings.TrimPrefix(sac.IdentityDomain, "svc.")
	targetSA := fmt.Sprintf("%s/ns/%s/sa/%s", istioDomain, namespace, serviceAccount)
	for _, sa := range serviceAccounts {
		if sa == targetSA {
			return true
		}
	}

	return false
}
