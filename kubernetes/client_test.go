package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetList(t *testing.T) {
	assert := assert.New(t)

	listOptions := GetLabeledListOptions("app=helloworld")

	assert.Equal(listOptions.LabelSelector, "app=helloworld")
}
