package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/tests/data"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoDestinationChecker{
		Namespace:       "test-namespace",
		Services:        getServices([]string{"reviews", "other"}),
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// reviews is not part of service names
	validations, valid := NoDestinationChecker{
		Namespace:       "test-namespace",
		Services:        getServices([]string{"details", "other"}),
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Host doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/host", validations[0].Path)
}

func TestNoMatchingSubset(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	services := getServices([]string{"reviews"})
	services["reviews"] = []string{"v1"}

	// reviews does not have v2 in known services
	validations, valid := NoDestinationChecker{
		Namespace:       "test-namespace",
		Services:        services,
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("This subset is not found from the host", validations[0].Message)
	assert.Equal("spec/subsets[0]/version", validations[0].Path)
}

func getServices(services []string) map[string][]string {
	serviceMap := make(map[string][]string, len(services))

	for _, s := range services {
		serviceMap[s] = []string{"v1", "v2"}
	}
	return serviceMap
}
