package api

import (
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kialiClient "github.com/kiali/kiali/tests/integration_bdd/utils/kiali"
)

var _ = Describe("Kiali API Status", func() {
	var (
		client *kialiClient.EnhancedKialiClient
	)

	BeforeEach(func() {
		client = kialiClient.NewEnhancedKialiClient()
	})

	Context("when Kiali is properly deployed", func() {
		It("should return healthy status", func() {
			By("requesting Kiali status endpoint")
			Expect(client.GetStatusEventually(30 * time.Second)).To(BeTrue())
		})

		It("should return HTTP 200 status code", func() {
			By("verifying the HTTP response code")
			Eventually(func() int {
				_, statusCode, _ := client.GetStatus()
				return statusCode
			}, 30*time.Second, 5*time.Second).Should(Equal(200))
		})

		It("should not return any errors", func() {
			By("ensuring no errors occur during status check")
			Eventually(func() error {
				_, _, err := client.GetStatus()
				return err
			}, 30*time.Second, 5*time.Second).Should(BeNil())
		})
	})
})
