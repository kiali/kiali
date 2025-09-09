package kiali

import (
	"time"

	. "github.com/onsi/gomega"
	
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

// EnhancedKialiClient wraps the existing Kiali client with BDD-friendly methods
type EnhancedKialiClient struct {
	originalClient *kiali.KialiClient
}

// NewEnhancedKialiClient creates a new enhanced Kiali client
func NewEnhancedKialiClient() *EnhancedKialiClient {
	return &EnhancedKialiClient{
		originalClient: kiali.NewKialiClient(),
	}
}

// GetStatusEventually returns an AsyncAssertion for Kiali status with Eventually() support
func (c *EnhancedKialiClient) GetStatusEventually(timeout time.Duration) AsyncAssertion {
	return Eventually(func() (bool, error) {
		status, statusCode, err := kiali.KialiStatus()
		if err != nil {
			return false, err
		}
		if statusCode != 200 {
			return false, nil
		}
		return status, nil
	}, timeout, 5*time.Second)
}

// GetStatus provides direct access to the Kiali status for non-async usage
func (c *EnhancedKialiClient) GetStatus() (bool, int, error) {
	return kiali.KialiStatus()
} 