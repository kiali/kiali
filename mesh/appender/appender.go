package appender

import (
	"fmt"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/mesh"
)

const ()

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o mesh.Options) (appenders []mesh.Appender, finalizers []mesh.Appender) {

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
