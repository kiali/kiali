package destination_rules

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/tests/data"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:       "test-namespace",
		ServiceNames:    []string{"reviews", "other"},
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
	validations, valid := NoHostChecker{
		Namespace:       "test-namespace",
		ServiceNames:    []string{"details", "other"},
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Host doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/host", validations[0].Path)
}
