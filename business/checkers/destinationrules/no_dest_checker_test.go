package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
		),
		Services:        fakeServicesReview(),
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidWildcardHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
		),
		Services: fakeServicesReview(),
		DestinationRule: data.CreateTestDestinationRule("test-namespace",
			"name", "*.test-namespace.svc.cluster.local"),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidMeshWideHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
		),
		Services:        fakeServicesReview(),
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "*.local"),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// reviews is not part of services
	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("otherv1", appVersionLabel("other", "v1")),
		),
		Services:        []v1.Service{},
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.nodest.matchingworkload"), validations[0].Message)
	assert.Equal("spec/host", validations[0].Path)
}

func TestNoMatchingSubset(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// reviews does not have v2 in known services
	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("reviews", appVersionLabel("reviews", "v1")),
		),
		Services:        fakeServicesReview(),
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.nodest.subsetlabels"), validations[0].Message)
	assert.Equal("spec/subsets[0]", validations[0].Path)
}

func TestNoMatchingSubsetWithMoreLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.AddSubsetToDestinationRule(map[string]interface{}{
		"name": "reviewsv2",
		"labels": map[string]interface{}{
			"version": "v2",
		}},
		data.AddSubsetToDestinationRule(map[string]interface{}{
			"name": "reviewsv1",
			"labels": map[string]interface{}{
				"version": "v1",
				"seek":    "notfound",
			}}, data.CreateEmptyDestinationRule("test-namespace", "name", "reviews")))

	validations, valid := NoDestinationChecker{
		Namespace: "test-namespace",
		WorkloadList: data.CreateWorkloadList("test-namespace",
			data.CreateWorkloadListItem("reviews", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviews", appVersionLabel("reviews", "v2")),
		),
		Services:        fakeServicesReview(),
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.nodest.subsetlabels"), validations[0].Message)
	assert.Equal("spec/subsets[0]", validations[0].Path)
}

func fakeServicesReview() []v1.Service {
	return []v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews",
				Namespace: "test-namespace",
				Labels: map[string]string{
					"app":     "reviews",
					"version": "v1"}},
			Spec: v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": "reviews"},
			},
		},
	}
}
