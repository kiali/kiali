package controller_test

import (
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apinetworkingv1beta1 "istio.io/api/networking/v1beta1"
	networkingv1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/models"
)

var _ = Describe("Validations controller", func() {
	const (
		timeout  = time.Second * 10
		interval = time.Millisecond * 250
	)

	Context("When validating a VirtualService", func() {
		It("Should create validations in the kiali cache when a new VirtualService is created", func() {
			Expect(kialiCache.Validations().Items()).Should(BeEmpty())

			By("By creating a VirtualService")
			istioSystemNamespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: "istio-system",
				},
			}
			Expect(k8sClient.Create(ctx, istioSystemNamespace)).Should(Succeed())
			vs := &networkingv1beta1.VirtualService{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-vs",
					Namespace: "default",
				},
				Spec: apinetworkingv1beta1.VirtualService{
					Hosts:    []string{"test.com"},
					Gateways: []string{"test-gateway"},
				},
			}
			Expect(k8sClient.Create(ctx, vs)).Should(Succeed())

			vsKey := types.NamespacedName{Name: vs.Name, Namespace: vs.Namespace}
			createdVS := &networkingv1beta1.VirtualService{}

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

		It("Should update validations in the kiali cache when an existing VirtualService is updated", func() {
			validationKey := models.IstioValidationKey{Name: "test-vs", Namespace: "default", ObjectType: "virtualservice"}
			validation, err := kialiCache.Validations().Get(validationKey)
			Expect(err).ShouldNot(HaveOccurred())
			Expect(validation.Checks).Should(BeEmpty())
			By("By updating a VirtualService")
			vs := &networkingv1beta1.VirtualService{}
			vsKey := types.NamespacedName{Name: "test-vs", Namespace: "default"}
			Expect(k8sClient.Get(ctx, vsKey, vs)).Should(Succeed())
			// Duplicate routes should be invalid.
			vs.Spec.Http = []*apinetworkingv1beta1.HTTPRoute{
				{
					Route: []*apinetworkingv1beta1.HTTPRouteDestination{
						{
							Destination: &apinetworkingv1beta1.Destination{
								Host: "test.com",
							},
						},
						{
							Destination: &apinetworkingv1beta1.Destination{
								Host: "test.com",
							},
						},
					},
				},
			}
			Expect(k8sClient.Update(ctx, vs)).Should(Succeed())

			By("By checking that the validations are then updated in the kiali cache")
			Eventually(func() bool {
				validation, err := kialiCache.Validations().Get(validationKey)
				Expect(err).ShouldNot(HaveOccurred())
				return len(validation.Checks) > 0
			}, timeout, interval).Should(BeTrue())
		})

		It("Should delete validations in the kiali cache when the VirtualService is deleted", func() {
			By("By deleting a VirtualService")
			vs := &networkingv1beta1.VirtualService{}
			vsKey := types.NamespacedName{Name: "test-vs", Namespace: "default"}
			Expect(k8sClient.Get(ctx, vsKey, vs)).Should(Succeed())
			Expect(k8sClient.Delete(ctx, vs)).Should(Succeed())

			By("By checking that the validations are then deleted from the kiali cache")
			Eventually(func() bool {
				validationKey := models.IstioValidationKey{Name: "test-vs", Namespace: "default", ObjectType: "virtualservice"}
				_, err := kialiCache.Validations().Get(validationKey)
				return err != nil && len(kialiCache.Validations().Items()) == 0
			}, timeout, interval).Should(BeTrue())
		})
	})
})
