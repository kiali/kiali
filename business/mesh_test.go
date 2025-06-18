package business_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestGetMeshConfig(t *testing.T) {
	check := assert.New(t)

	k8s := kubetest.NewFakeK8sClient()
	conf := config.NewConfig()

	config.Set(conf)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultServiceExportTo:         []string{"*"},
						DefaultDestinationRuleExportTo: []string{"."},
						DefaultVirtualServiceExportTo:  []string{"."},
					},
				},
			}},
		},
	}

	business.WithDiscovery(discovery)
	layer := business.NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	meshSvc := layer.Mesh

	meshConfig := meshSvc.GetMeshConfig()

	check.NotNil(meshConfig, "Mesh Config")
	check.Equal([]string{"."}, meshConfig.DefaultVirtualServiceExportTo)
	check.Equal([]string{"."}, meshConfig.DefaultDestinationRuleExportTo)
	check.Equal([]string{"*"}, meshConfig.DefaultServiceExportTo)
}
