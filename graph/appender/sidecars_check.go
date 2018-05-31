package appender

import (
	"strings"

	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers"
)

type SidecarsCheckAppender struct{}

// AppendGraph implements Appender
func (a SidecarsCheckAppender) AppendGraph(trees *[]*tree.ServiceNode, _ string) {
	if len(*trees) == 0 {
		return
	}

	k8s, err := kubernetes.NewClient()
	checkError(err)

	for _, tree := range *trees {
		a.applySidecarsChecks(tree, k8s)
	}
}

func (a SidecarsCheckAppender) applySidecarsChecks(n *tree.ServiceNode, k8s *kubernetes.IstioClient) {
	if n.Name == tree.UnknownService {
		return
	}
	split := strings.Split(n.Name, ".")
	serviceName := split[0]
	namespaceName := split[1]
	serviceVersion := n.Version

	pods, err := k8s.GetServicePods(namespaceName, serviceName, serviceVersion)
	checkError(err)

	checker := checkers.PodChecker{Pods: pods.Items}
	validations := checker.Check()

	sidecarsOk := true
	for _, check := range validations {
		sidecarsOk = sidecarsOk && check.Valid
	}
	n.Metadata["hasMissingSidecars"] = !sidecarsOk

	for _, child := range n.Children {
		a.applySidecarsChecks(child, k8s)
	}
}
