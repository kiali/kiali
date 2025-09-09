package integration_bdd_test

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestIntegrationBdd(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "IntegrationBdd Suite")
}
