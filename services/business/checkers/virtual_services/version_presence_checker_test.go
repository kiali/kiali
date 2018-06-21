package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func TestCheckerWithPodsMatching(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeCorrectVersions()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
}

func fakePodsForLabels(namespace string, labels labels.Set) v1.Pod {
	return v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-12345-hello",
			Namespace: namespace,
			Labels:    labels,
		},
	}
}

func fakeDestinationRule(hostName string) kubernetes.IstioObject {
	destinationRule := kubernetes.DestinationRule{
		Spec: map[string]interface{}{
			"host": hostName,
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
	}

	return destinationRule.DeepCopyIstioObject()
}

func fakeCorrectVersions() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews.bookinfo.svc.cluster.local",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews.bookinfo.svc.cluster.local",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestCheckerWithPodsMatchingShortHostname(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeCorrectVersionsShortHostname()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
}

func fakeCorrectVersionsShortHostname() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestCheckerWrongNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeCorrectVersionsShortHostnameWrongNamespace()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)

	assert.Equal(validations[0].Message, "No pods found for this selector")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "No pods found for this selector")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}

func fakeCorrectVersionsShortHostnameWrongNamespace() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "not-from-bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestNoMatchingPods(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"not-a-version": "v1"}),
		fakePodsForLabels("bookinfo", map[string]string{"version": "not-v2"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeCorrectVersions()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "No pods found for this selector")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "No pods found for this selector")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}

func TestSubsetsNotFound(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"version": "v1"}),
		fakePodsForLabels("bookinfo", map[string]string{"version": "v2"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeWrongSubsets()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "Subset not found")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "Subset not found")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}

func fakeWrongSubsets() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews.bookinfo.svc.cluster.local",
								"subset": "not-v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "not-v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestVirtualServiceWithoutDestination(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo",
		podList, destinationList, fakeNilDestination()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Destination field is mandatory")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]")
}

func fakeNilDestination() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews.bookinfo.svc.cluster.local",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestVirtualServiceWithoutSpec(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo", podList,
		destinationList, fakeBadSpec()}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func fakeBadSpec() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func TestWrongDestinationRule(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("ratings"),
	}

	validations, valid := VersionPresenceChecker{"bookinfo", podList,
		destinationList, fakeCorrectVersions()}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "Subset not found")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "Subset not found")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}
