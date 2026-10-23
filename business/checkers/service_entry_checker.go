package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/serviceentries"
	"github.com/kiali/kiali/models"
)

// ServiceEntryChecker checks host conflicts among entries available in the validation namespace.
type ServiceEntryChecker struct {
	Cluster        string
	ImportScope    common.ImportScope
	ServiceEntries []*networking_v1.ServiceEntry
}

func (s ServiceEntryChecker) Check() models.IstioValidations {
	// Multi-match (KIA1211/1212) only considers Sidecar-imported ServiceEntries.
	conflictSEs := common.FilterServiceEntriesByImport(s.ServiceEntries, s.ImportScope)
	return serviceentries.MultiMatchChecker{
		Cluster:        s.Cluster,
		ServiceEntries: conflictSEs,
	}.Check()
}
