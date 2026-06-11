package serviceentries

import (
	"fmt"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	Cluster        string
	ServiceEntries []*networking_v1.ServiceEntry
}

type hostPortKey struct {
	Host       string
	PortNumber uint32
}

type sePortEntry struct {
	Name      string
	Namespace string
	PortIndex int
	Protocol  string
}

func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	index := make(map[hostPortKey][]sePortEntry)

	for _, se := range m.ServiceEntries {
		for portIndex, port := range se.Spec.Ports {
			if port == nil {
				continue
			}
			protocol := strings.ToUpper(port.Protocol)
			for _, host := range se.Spec.Hosts {
				key := hostPortKey{Host: host, PortNumber: port.Number}
				index[key] = append(index[key], sePortEntry{
					Name:      se.Name,
					Namespace: se.Namespace,
					Protocol:  protocol,
					PortIndex: portIndex,
				})
			}
		}
	}

	for _, entries := range index {
		if len(entries) < 2 {
			continue
		}
		checkID := "serviceentries.multimatch"
		if hasProtocolConflict(entries) {
			checkID = "serviceentries.port.protocol.conflict"
		}
		m.addValidations(validations, entries, checkID)
	}

	return validations
}

func hasProtocolConflict(entries []sePortEntry) bool {
	first := entries[0].Protocol
	for _, e := range entries[1:] {
		if e.Protocol != first {
			return true
		}
	}
	return false
}

func (m MultiMatchChecker) addValidations(validations models.IstioValidations, entries []sePortEntry, checkID string) {
	keys := make([]models.IstioValidationKey, 0, len(entries))
	vals := make([]*models.IstioValidation, 0, len(entries))

	for _, entry := range entries {
		key := models.IstioValidationKey{
			Name:      entry.Name,
			Namespace: entry.Namespace,
			ObjectGVK: kubernetes.ServiceEntries,
			Cluster:   m.Cluster,
		}
		check := models.Build(checkID,
			fmt.Sprintf("spec/ports[%d]", entry.PortIndex))
		val := &models.IstioValidation{
			Cluster:    m.Cluster,
			Name:       entry.Name,
			Namespace:  entry.Namespace,
			ObjectGVK:  kubernetes.ServiceEntries,
			Valid:      true,
			Checks:     []*models.IstioCheck{&check},
			References: make([]models.IstioValidationKey, 0),
		}
		keys = append(keys, key)
		vals = append(vals, val)
	}

	for i := range vals {
		for j := range keys {
			if i == j {
				continue
			}
			vals[i].References = append(vals[i].References, keys[j])
		}
		validations.MergeValidations(models.IstioValidations{keys[i]: vals[i]})
	}
}
