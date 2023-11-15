package appender

import (
	"fmt"

	"github.com/kiali/kiali/graph"
)

const ()

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o graph.TelemetryOptions) (appenders []graph.Appender, finalizers []graph.Appender) {

	if !o.Appenders.All {
		for _, appenderName := range o.Appenders.AppenderNames {
			switch appenderName {

			// namespace appenders

			// finalizer appenders

			default:
				graph.BadRequest(fmt.Sprintf("Invalid appender [%s]", appenderName))
			}
		}
	}

	// The appender order is important

	// The finalizer order is important

	return appenders, finalizers
}
