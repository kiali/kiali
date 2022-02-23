package finalizer

import (
	"fmt"

	"github.com/kiali/kiali/graph"
)

// ParseFinalizers determines which finalizers should run for this graphing request
func ParseFinalizers(o graph.TelemetryOptions) []graph.Finalizer {

	// some finalizers are optional - any optional finalizer that is requested is put in this map
	optionalFinalizers := make(map[string]bool)
	if !o.Finalizers.All {
		for _, finalizerName := range o.Finalizers.FinalizerNames {
			switch finalizerName {
			case "":
				// skip
			case OutsiderFinalizerName, TrafficGeneratorFinalizerName:
				// skip - these are always invoked, but if they are specified, just ignore it
			case LabelerFinalizerName:
				optionalFinalizers[LabelerFinalizerName] = true
			default:
				graph.BadRequest(fmt.Sprintf("Invalid finalizer [%s]", finalizerName))
			}
		}
	} else {
		optionalFinalizers[LabelerFinalizerName] = true
	}

	// The finalizer order is important
	var finalizers []graph.Finalizer

	// always run the outsider finalizer
	finalizers = append(finalizers, &OutsiderFinalizer{})

	// if labeler finalizer is to be run, do it after the outsider finalizer
	if _, ok := optionalFinalizers[LabelerFinalizerName]; ok {
		finalizers = append(finalizers, &LabelerFinalizer{})
	}

	// always run the traffic generator finalizer
	finalizers = append(finalizers, &TrafficGeneratorFinalizer{})

	return finalizers
}
