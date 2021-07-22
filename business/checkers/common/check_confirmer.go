package common

import (
	"fmt"

	"github.com/kiali/kiali/models"
)

// ConfirmIstioCheckMessage can be used by the validation tests to confirm the Istio Check received is what was expected
func ConfirmIstioCheckMessage(expectedIstioCheckKey string, actualIstioCheck *models.IstioCheck) error {
	expected := models.CheckMessage(expectedIstioCheckKey)
	actual := actualIstioCheck.GetFullMessage()
	if expected == actual {
		return nil
	} else {
		return fmt.Errorf("IstioCheck: expected [%s], actual [%s]", expected, actual)
	}
}
