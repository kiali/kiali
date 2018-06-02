package appender

import (
	"strings"

	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/services/business"
)

type HealthAppender struct{}

// TODO: AppendGraph should probably get the options so that it can apply the
// proper interval to the health query.

// AppendGraph implements Appender. It appends Health information to nodes flagged
// as "isHealthIndicator"="true".
func (a HealthAppender) AppendGraph(trees *[]*tree.ServiceNode, _ string) {
	if len(*trees) == 0 {
		return
	}

	business, err := business.Get()
	checkError(err)

	for _, tree := range *trees {
		a.applyHealth(tree, business)
	}
}

func (a HealthAppender) applyHealth(n *tree.ServiceNode, business *business.Layer) {
	if n.Name != tree.UnknownService && n.Metadata["isHealthIndicator"] == "true" {
		split := strings.Split(n.Name, ".")
		serviceName := split[0]
		namespaceName := split[1]

		// TODO: Health is not version specific, perhaps it should be, or at least the
		// parts where it is possible. For example, envoy is not version-sepcific
		health := business.Health.GetServiceHealth(namespaceName, serviceName, "10m")

		n.Metadata["health"] = &health
	}

	for _, child := range n.Children {
		a.applyHealth(child, business)
	}
}
