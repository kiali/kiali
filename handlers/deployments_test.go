package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func setupDeploymentList() (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/workloads", DeploymentList)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

func TestDeploymentList(t *testing.T) {
	ts, k8s, _ := setupDeploymentList()
	defer ts.Close()

	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)

	url := ts.URL + "/api/namespaces/ns/workloads"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
}

func fakeDeploymentList() *v1beta1.DeploymentList {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return &v1beta1.DeploymentList{
		Items: []v1beta1.Deployment{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:              "httpbin-v1",
					CreationTimestamp: meta_v1.NewTime(t1),
					Labels:            map[string]string{"app": "httpbin", "version": "v1"}},
				Status: v1beta1.DeploymentStatus{
					Replicas:            1,
					AvailableReplicas:   1,
					UnavailableReplicas: 0,
				},
			},
		},
	}
}
