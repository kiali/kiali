package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSelectorToString(t *testing.T) {
	assert := assert.New(t)
	selector := make(map[string]string)
	selector["a"] = "1"
	selector["b"] = "2"

	str := selectorToString(selector)

	assert.Equal("a=1,b=2", str)
}

func TestFilterDeploymentsForService(t *testing.T) {
	assert := assert.New(t)
	selector := make(map[string]string)
	selector["foo"] = "bar"

	service := v1.Service{
		Spec: v1.ServiceSpec{
			Selector: selector}}

	deployments := v1beta1.DeploymentList{
		Items: []v1beta1.Deployment{
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "httpbin-v1",
					Labels: map[string]string{"foo": "bazz", "version": "v1"}}},
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v1",
					Labels: map[string]string{"foo": "bar", "version": "v1"}}},
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v2",
					Labels: map[string]string{"foo": "bar", "version": "v2"}}}}}

	matches := *FilterDeploymentsForService(&service, &deployments)

	assert.Len(matches, 2)
	assert.Equal("reviews-v1", matches[0].ObjectMeta.Name)
	assert.Equal("reviews-v2", matches[1].ObjectMeta.Name)
}
