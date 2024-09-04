package business_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

type fakeMeshDiscovery struct {
	mesh models.Mesh
}

func (fmd *fakeMeshDiscovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	return &fmd.mesh, nil
}

// TestCanaryUpgradeNotConfigured verifies that when there is no canary upgrade configured, both the migrated and pending namespace lists are empty
func TestCanaryUpgradeNotConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioCanaryRevision.Current = "default"
	conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade = "canary"

	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetNamespaces", "istio-injection=enabled").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return([]core_v1.Namespace{}, nil)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := business.NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.NotNil(canaryUpgradeStatus)
}

// TestCanaryUpgradeConfigured verifies that when there is a canary upgrade in place, the migrated and pending namespaces should have namespaces
func TestCanaryUpgradeConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioCanaryRevision.Current = "default"
	conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade = "canary"

	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)

	migratedNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-agency"},
	}
	migratedNamespaces := []core_v1.Namespace{migratedNamespace}

	pendingNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-portal"},
	}
	pendingNamespaces := []core_v1.Namespace{pendingNamespace}

	k8s.On("GetNamespaces", "istio-injection=enabled").Return(pendingNamespaces, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return(migratedNamespaces, nil)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := business.NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.Contains(canaryUpgradeStatus.MigratedNamespaces, "travel-agency")
	check.Equal(1, len(canaryUpgradeStatus.MigratedNamespaces))
	check.Contains(canaryUpgradeStatus.PendingNamespaces, "travel-portal")
	check.Equal(1, len(canaryUpgradeStatus.PendingNamespaces))
}

func TestGetMeshConfig(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()

	config.Set(conf)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	discovery := &fakeMeshDiscovery{
		mesh: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName, IsKialiHome: true},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						DefaultServiceExportTo:         []string{"*"},
						DefaultDestinationRuleExportTo: []string{"."},
						DefaultVirtualServiceExportTo:  []string{"."},
					},
				},
			}},
		},
	}

	business.WithDiscovery(discovery)
	layer := business.NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	meshConfig := meshSvc.GetMeshConfig()

	check.NotNil(meshConfig, "Mesh Config")
	check.Equal([]string{"."}, meshConfig.DefaultVirtualServiceExportTo)
	check.Equal([]string{"."}, meshConfig.DefaultDestinationRuleExportTo)
	check.Equal([]string{"*"}, meshConfig.DefaultServiceExportTo)
}
