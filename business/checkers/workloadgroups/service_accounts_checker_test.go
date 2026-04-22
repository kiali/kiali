package workloadgroups

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestServiceAccountsChecker(t *testing.T) {
	defaultSAs := map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}}
	nonDefaultSAs := map[string][]string{config.DefaultClusterID: {"example.org/ns/bookinfo/sa/default", "example.org/ns/bookinfo/sa/test"}}
	diffNsSAs := map[string][]string{config.DefaultClusterID: {"cluster.local/ns/default/sa/default", "cluster.local/ns/bookinfo/sa/test"}}

	cases := map[string]struct {
		identityDomain  string
		serviceAccounts map[string][]string
		saName          string
		expectValid     bool
		expectMessage   string
	}{
		"present SA": {
			identityDomain:  "svc.cluster.local",
			serviceAccounts: defaultSAs,
			saName:          "default",
			expectValid:     true,
		},
		"empty SA name is valid": {
			identityDomain:  "svc.cluster.local",
			serviceAccounts: defaultSAs,
			saName:          "",
			expectValid:     true,
		},
		"missing SA": {
			identityDomain:  "svc.cluster.local",
			serviceAccounts: defaultSAs,
			saName:          "wrong",
			expectValid:     false,
			expectMessage:   "workloadgroup.template.serviceaccount.notfound",
		},
		"different namespace SA": {
			identityDomain:  "svc.cluster.local",
			serviceAccounts: diffNsSAs,
			saName:          "default",
			expectValid:     false,
			expectMessage:   "workloadgroup.template.serviceaccount.notfound",
		},
		"present SA with non-default trust domain": {
			identityDomain:  "svc.example.org",
			serviceAccounts: nonDefaultSAs,
			saName:          "default",
			expectValid:     true,
		},
		"missing SA with non-default trust domain": {
			identityDomain:  "svc.example.org",
			serviceAccounts: nonDefaultSAs,
			saName:          "wrong",
			expectValid:     false,
			expectMessage:   "workloadgroup.template.serviceaccount.notfound",
		},
		"empty service accounts map": {
			identityDomain:  "svc.cluster.local",
			serviceAccounts: map[string][]string{},
			saName:          "wrong",
			expectValid:     false,
			expectMessage:   "workloadgroup.template.serviceaccount.notfound",
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			vals, valid := ServiceAccountsChecker{
				Cluster:         config.DefaultClusterID,
				IdentityDomain:  tc.identityDomain,
				ServiceAccounts: tc.serviceAccounts,
				WorkloadGroup:   data.CreateWorkloadGroupWithSA(tc.saName),
			}.Check()

			assert.Equal(tc.expectValid, valid)
			if tc.expectValid {
				assert.Empty(vals)
			} else {
				assert.Len(vals, 1)
				assert.Equal(models.WarningSeverity, vals[0].Severity)
				assert.NoError(validations.ConfirmIstioCheckMessage(tc.expectMessage, vals[0]))
				assert.Equal("spec/template/serviceAccount", vals[0].Path)
			}
		})
	}
}
