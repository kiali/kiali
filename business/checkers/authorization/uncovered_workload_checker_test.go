package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCoveredworkloads(t *testing.T) {
	assert := assert.New(t)

	//firstCase - authorization policy namespace is wide mesh and has no selector (covers all workloads)
	validations := UncoveredWorkloadChecker{AuthorizationPolicies: []kubernetes.IstioObject{data.CreateEmptyMeshAuthorizationPolicy("test-root")},
		WorkloadList: workloadListNS1()}.Check()

	assert.Empty(validations)

	// second case - authorization policy has no selector , it and workloads in same namespace
	validations = UncoveredWorkloadChecker{AuthorizationPolicies: []kubernetes.IstioObject{data.CreateEmptyAuthorizationPolicy("test-ns", "bookinfo")},
		WorkloadList: workloadListNS1()}.Check()

	assert.Empty(validations)

	// third case - each workload has a matching authorization policy (same ns and labels)
	validations = UncoveredWorkloadChecker{AuthorizationPolicies: authorizationPoliciesNS1(),
		WorkloadList: workloadListNS1()}.Check()

	assert.Empty(validations)
}

func TestUnCoveredWorkloads(t *testing.T) {
	assert := assert.New(t)
	//case 1 - authpolicy in root ns with unmatching selector
	testFailure(assert,
		[]kubernetes.IstioObject{data.CreateAuthorizationPolicyWithMetaAndSelector("test-root2", "istio-system", map[string]interface{}{"app": "wrong", "version": "v4"})},
		workloadListNS1(), 3)
	// case 2 - workloads has different namespace than of all authpolicies
	testFailure(assert, authorizationPoliciesNS1(), workloadListNS2(), 2)
	//case3 - workloads and authpolicy have same namespace but some workloads has unmatching labels
	testFailure(assert,
		[]kubernetes.IstioObject{data.CreateAuthorizationPolicyWithMetaAndSelector("test-no-match", "bookinfo", map[string]interface{}{"app": "ratings", "version": "v1"})},
		workloadListNS1(), 2)
	//case4 - no authorization policy found
	testFailure(assert, []kubernetes.IstioObject{}, workloadListNS2(), 2)
}

func testFailure(assert *assert.Assertions, authpolicies []kubernetes.IstioObject, workloads models.WorkloadList, lenVals int) {
	validations := UncoveredWorkloadChecker{AuthorizationPolicies: authpolicies,
		WorkloadList: workloads}.Check()

	assert.NotEmpty(validations)
	assert.Len(validations, lenVals)
	for _, v := range validations {
		assert.Equal(v.Checks[0].Code+" "+v.Checks[0].Message, models.CheckMessage("authorizationpolicy.workload.needstobecovered"))
		assert.Equal(v.Checks[0].Severity, models.WarningSeverity)
		assert.Equal(v.Valid, false)
	}
}

func workloadListNS1() models.WorkloadList {
	wlitems := []models.WorkloadListItem{
		data.CreateWorkloadListItem("covered-workload1", map[string]string{"app": "ratings", "version": "v1"}),
		data.CreateWorkloadListItem("covered-workload2", map[string]string{"app": "productpage", "version": "v1"}),
		data.CreateWorkloadListItem("covered-workload3", map[string]string{"app": "details", "version": "v3"}),
	}

	return data.CreateWorkloadList("bookinfo", wlitems...)
}

func workloadListNS2() models.WorkloadList {
	wlitems := []models.WorkloadListItem{
		data.CreateWorkloadListItem("uncovered-workload1", map[string]string{"app": "ratings", "version": "v1"}),
		data.CreateWorkloadListItem("uncovered-workload2", map[string]string{"app": "details", "version": "v2"}),
	}
	return data.CreateWorkloadList("movieinfo", wlitems...)
}

func authorizationPoliciesNS1() []kubernetes.IstioObject {
	auths := []kubernetes.IstioObject{
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy1", "bookinfo", map[string]interface{}{"app": "ratings", "version": "v1"}),
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy2", "bookinfo", map[string]interface{}{"app": "productpage", "version": "v1"}),
		data.CreateAuthorizationPolicyWithMetaAndSelector("auth-policy3", "bookinfo", map[string]interface{}{"app": "details", "version": "v3"}),
	}
	return auths
}
