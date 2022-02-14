package finalizer

import (
	"github.com/kiali/kiali/graph"
)

// ParseFinalizers determines which finalizers should run for this graphing request
func ParseFinalizers(o graph.TelemetryOptions) []graph.Finalizer {

	/* Uncomment and add cases when we have queryParam finalizers
	 *
	requestedFinalizers := make(map[string]bool)
	if !o.Finalizers.All {
		for _, finalizerName := range o.Finalizers.FinalizerNames {
			switch finalizerName {
			case "":
				// skip
			default:
				graph.BadRequest(fmt.Sprintf("Invalid finalizer [%s]", finalizerName))
			}
		}
	}
	*/

	// The finalizer order is important, run the standard finalizers at the end
	var finalizers []graph.Finalizer

	// always run the outsider finalizer
	finalizers = append(finalizers, &OutsiderFinalizer{})
	// always run the traffic generator finalizer
	finalizers = append(finalizers, &TrafficGeneratorFinalizer{})

	return finalizers
}
