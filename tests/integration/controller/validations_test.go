package controller

import (
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apinetworkingv1 "istio.io/api/networking/v1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/controller"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

const (
	timeout  = time.Second * 10
	interval = time.Millisecond * 250
)

var _ = Describe("Validations controller", Ordered, func() {
	var kialiCache cache.KialiCache
	Context("When validating a VirtualService", func() {
		BeforeAll(func(specCtx SpecContext) {
			conf := config.NewConfig()
			kialiKubeClient, err := kubernetes.NewClientWithRemoteClusterInfo(cfg, nil)
			Expect(err).ToNot(HaveOccurred())

			saClients := map[string]kubernetes.ClientInterface{
				conf.KubernetesConfig.ClusterName: kialiKubeClient,
			}
			kialiCache, err = cache.NewKialiCache(saClients, *conf)
			Expect(err).ToNot(HaveOccurred())
			DeferCleanup(func() {
				kialiCache.Stop()
			})

			kialiCache.SetMesh(
				&models.Mesh{
					ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{IsKialiHome: true}}},
				},
			)

			discovery := istio.NewDiscovery(saClients, kialiCache, conf)
			layer, err := business.NewLayerWithSAClients(conf, kialiCache, nil, nil, nil, nil, discovery, saClients)
			Expect(err).ToNot(HaveOccurred())

			err = controller.NewValidationsController(ctx, []string{conf.KubernetesConfig.ClusterName}, kialiCache, &layer.Validations, k8sManager, util.AsPtr(time.Millisecond*100))
			Expect(err).ToNot(HaveOccurred())
		})

		It("Should create validations in the kiali cache when a new VirtualService is created", func(ctx SpecContext) {
			Expect(kialiCache.Validations().Items()).Should(BeEmpty())

			By("By creating a VirtualService")
			istioSystemNamespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: "istio-system",
				},
			}
			err := k8sClient.Create(ctx, istioSystemNamespace)
			Expect(client.IgnoreAlreadyExists(err)).ToNot(HaveOccurred())
			vs := &networkingv1.VirtualService{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-vs",
					Namespace: "default",
				},
				Spec: apinetworkingv1.VirtualService{
					Hosts:    []string{"test.com"},
					Gateways: []string{"test-gateway"},
				},
			}
			err = k8sClient.Create(ctx, vs)
			Expect(client.IgnoreAlreadyExists(err)).ToNot(HaveOccurred())

			vsKey := types.NamespacedName{Name: vs.Name, Namespace: vs.Namespace}
			createdVS := &networkingv1.VirtualService{}

			Eventually(func() bool {
				err := k8sClient.Get(ctx, vsKey, createdVS)
				return err == nil
			}, timeout, interval).Should(BeTrue())
			Expect(createdVS.Spec.Hosts).Should(Equal([]string{"test.com"}))

			By("By checking that the validations are created in the kiali cache")
			Eventually(func() bool {
				validations := kialiCache.Validations().Items()
				return len(validations) > 0
			}, timeout, interval).Should(BeTrue())
		})

		It("Should update validations in the kiali cache when an existing VirtualService is updated", func(ctx SpecContext) {
			validationKey := models.IstioValidationKey{Name: "test-vs", Namespace: "default", ObjectGVK: kubernetes.VirtualServices}
			validation, found := kialiCache.Validations().Get(validationKey)
			Expect(found).To(BeTrue())
			Expect(validation.Checks).Should(BeEmpty())
			By("By updating a VirtualService")
			vs := &networkingv1.VirtualService{}
			vsKey := types.NamespacedName{Name: "test-vs", Namespace: "default"}
			Expect(k8sClient.Get(ctx, vsKey, vs)).Should(Succeed())
			// Duplicate routes should be invalid.
			vs.Spec.Http = []*apinetworkingv1.HTTPRoute{
				{
					Route: []*apinetworkingv1.HTTPRouteDestination{
						{
							Destination: &apinetworkingv1.Destination{
								Host: "test.com",
							},
						},
						{
							Destination: &apinetworkingv1.Destination{
								Host: "test.com",
							},
						},
					},
				},
			}
			Expect(k8sClient.Update(ctx, vs)).Should(Succeed())

			By("By checking that the validations are then updated in the kiali cache")
			Eventually(func() bool {
				validation, found := kialiCache.Validations().Get(validationKey)
				Expect(found).To(BeTrue())
				return len(validation.Checks) > 0
			}, timeout, interval).Should(BeTrue())
		})

		It("Should delete validations in the kiali cache when the VirtualService is deleted", func(ctx SpecContext) {
			By("By deleting a VirtualService")
			vs := &networkingv1.VirtualService{}
			vsKey := types.NamespacedName{Name: "test-vs", Namespace: "default"}
			Expect(k8sClient.Get(ctx, vsKey, vs)).Should(Succeed())
			Expect(k8sClient.Delete(ctx, vs)).Should(Succeed())

			By("By checking that the validations are then deleted from the kiali cache")
			Eventually(func() bool {
				validationKey := models.IstioValidationKey{Name: "test-vs", Namespace: "default", ObjectGVK: kubernetes.VirtualServices}
				_, found := kialiCache.Validations().Get(validationKey)
				return !found && len(kialiCache.Validations().Items()) == 0
			}, timeout, interval).Should(BeTrue())
		})
	})
})
