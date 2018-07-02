package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCheckerWithPodsMatching(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeCorrectVersions()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
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

func TestCheckerWithSubsetsMatchingShortHostname(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeCorrectVersionsShortHostname()}.Check()

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

func TestSubsetsNotFound(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeWrongSubsets()}.Check()

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
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeNilDestination()}.Check()

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
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
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
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("ratings"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
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
