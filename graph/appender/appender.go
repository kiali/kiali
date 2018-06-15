package appender

import "github.com/kiali/kiali/graph"

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Appender interface {
	// AppendGraph performs the appender work on the provided traffic map. The map
	// may be initially empty. An appender is allowed to add or remove map entries.
	AppendGraph(trafficMap graph.TrafficMap, namespaceName string)
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}
