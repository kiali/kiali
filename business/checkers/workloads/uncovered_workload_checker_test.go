package workloads

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

const (
	ns1 = "bookinfo"
	ns2 = "movieinfo"
)

func TestCoveredworkloads(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)
	var vals []*models.IstioCheck
	var valid bool

	for _, wl := range workloadListNS2().Workloads {
		//firstCase - one authorization policy namespace is wide mesh and has no selector (covers all workloads including current workload),
		// while other auths has diffrenet namespaces than current workload
		vals, valid = UncoveredWorkloadChecker{
			Workload:              wl,
			Namespace:             ns2,
			AuthorizationPolicies: variedAuthPolicies1(),
		}.Check()

		assert.Empty(vals)
		assert.True(valid)

		// second case - one authorization policy has no selector but belongs to the curr workload ns (covers it),
		// while  other auths has diffrenet namespaces than current workload
		vals, valid = UncoveredWorkloadChecker{
			Workload:              wl,
			Namespace:             ns2,
			AuthorizationPolicies: variedAuthPolicies2(),
		}.Check()

		assert.Empty(vals)
		assert.True(valid)

	}

	// third case - curr workload in the same namespace and has a matching authorization policy (same ns and labels)
	vals, valid = UncoveredWorkloadChecker{
		Workload:              workloadListNS1().Workloads[1],
		Namespace:             ns1,
		AuthorizationPolicies: authorizationPoliciesNS1(),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestUnCoveredWorkloads(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)
	//case 1 - authpolicy in root ns with unmatching selector, other auths from another ns
	testFailure(assert, ns2,
		variedAuthPolicies3(),
		workloadListNS2().Workloads[0])

	// case 2 - curr workload has different namespace than of all authpolicies
	testFailure(assert, ns2, authorizationPoliciesNS1(), workloadListNS2().Workloads[1])

	//case3 - workload and authpolicies have same namespace but all auth policies have unmatching labels
	testFailure(assert, ns1,
		authorizationPoliciesNS1(),
		workloadListNS1().Workloads[3])

	//case4 - no authorization policy found
	testFailure(assert, ns2, []*security_v1.AuthorizationPolicy{}, workloadListNS2().Workloads[0])
}

func testFailure(assert *assert.Assertions, ns string, authpolicies []*security_v1.AuthorizationPolicy, workload models.WorkloadListItem) {
	vals, valid := UncoveredWorkloadChecker{
		Workload:              workload,
		Namespace:             ns,
		AuthorizationPolicies: authpolicies,
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.authorizationpolicy.needstobecovered", vals[0]))

}

func workloadListNS1() models.WorkloadList {
	wlitems := []models.WorkloadListItem{
		data.CreateWorkloadListItem("covered-workload1", map[string]string{"app": "ratings", "version": "v1"}),
		data.CreateWorkloadListItem("covered-workload2", map[string]string{"app": "productpage", "version": "v1"}),
		data.CreateWorkloadListItem("covered-workload3", map[string]string{"app": "details", "version": "v3"}),
		data.CreateWorkloadListItem("uncovered-workload", map[string]string{"app": "wrong", "version": "v5"}),
	}

	return data.CreateWorkloadList(ns1, wlitems...)
}

func workloadListNS2() models.WorkloadList {
	wlitems := []models.WorkloadListItem{
		data.CreateWorkloadListItem("uncovered-workload1", map[string]string{"app": "ratings", "version": "v1"}),
		data.CreateWorkloadListItem("uncovered-workload2", map[string]string{"app": "details", "version": "v2"}),
	}
	return data.CreateWorkloadList(ns2, wlitems...)
}

func authorizationPoliciesNS1() []*security_v1.AuthorizationPolicy {
	auths := []*security_v1.AuthorizationPolicy{
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy1", ns1, map[string]string{"app": "ratings", "version": "v1"}),
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy2", ns1, map[string]string{"app": "productpage", "version": "v1"}),
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy3", ns1, map[string]string{"app": "details", "version": "v3"}),
	}
	return auths
}

func variedAuthPolicies1() []*security_v1.AuthorizationPolicy {
	auths := []*security_v1.AuthorizationPolicy{
		data.CreateEmptyMeshAuthorizationPolicy("test-root"),
	}
	auths = append(auths, authorizationPoliciesNS1()...)

	return auths
}

func variedAuthPolicies2() []*security_v1.AuthorizationPolicy {
	auths := []*security_v1.AuthorizationPolicy{
		data.CreateEmptyAuthorizationPolicy("test-ns", ns2),
	}
	auths = append(auths, authorizationPoliciesNS1()...)

	return auths
}

func variedAuthPolicies3() []*security_v1.AuthorizationPolicy {
	auths := []*security_v1.AuthorizationPolicy{
		data.CreateAuthorizationPolicyWithMetaAndSelector("test-root2", "istio-system", map[string]string{"app": "wrong", "version": "v4"}),
	}
	auths = append(auths, authorizationPoliciesNS1()...)

	return auths
}
