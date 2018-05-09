package appender

import (
    "strings"

    "github.com/kiali/kiali/graph/tree"
    "github.com/kiali/kiali/kubernetes"
)

type IstioAppender struct {}

type namespaceInfo struct {
    destinationPolicies []kubernetes.IstioObject
    routeRules          []kubernetes.IstioObject
    virtualServices     []kubernetes.IstioObject
    destinationRules    []kubernetes.IstioObject
}

func (a IstioAppender) AppendGraph(trees *[]tree.ServiceNode, namespaceName string) {
    istioClient, err := kubernetes.NewClient()
    checkError(err)

    namespaceInfo := fetchNamespaceInfo(namespaceName, istioClient)

    for _, tree := range *trees {
        addRouteBadges(&tree, namespaceName, namespaceInfo)
    }
}

func fetchNamespaceInfo(namespaceName string, istioClient *kubernetes.IstioClient) namespaceInfo {
    destinationPolicies, err := istioClient.GetDestinationPolicies(namespaceName, "")
    checkError(err)

    routeRules, err := istioClient.GetRouteRules(namespaceName, "")
    checkError(err)

    virtualServices, err := istioClient.GetVirtualServices(namespaceName, "")
    checkError(err)

    destinationRules, err := istioClient.GetDestinationRules(namespaceName, "")
    checkError(err)

    return namespaceInfo{
        destinationPolicies: destinationPolicies,
        routeRules: routeRules,
        virtualServices: virtualServices,
        destinationRules: destinationRules,
    }
}

func addRouteBadges(n *tree.ServiceNode, namespaceName string, info namespaceInfo) {
    applyCircuitBreakers(n, namespaceName, info)
    applyRouteRules(n, namespaceName, info)

    for _, child := range n.Children {
        addRouteBadges(child, namespaceName, info)
    }
}

func applyCircuitBreakers(n *tree.ServiceNode, namespaceName string, info namespaceInfo) {
    serviceName := strings.Split(n.Name, ".")[0]
    version := n.Version

    found := false
    for _, destinationPolicy := range info.destinationPolicies {
        if kubernetes.CheckDestinationPolicyCircuitBreaker(destinationPolicy, namespaceName, serviceName, version) {
            n.Metadata["hasCircuitBreaker"] = "true"
            found = true
            break;
        }
    }

    // If we have found a CircuitBreaker from destinationPolicies we don't continue searching
    if !found {
        for _, destinationRule := range info.destinationRules {
            if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespaceName, serviceName, version) {
                n.Metadata["hasCircuitBreaker"] = "true"
                break;
            }
        }
    }
}

func applyRouteRules(n *tree.ServiceNode, namespaceName string, info namespaceInfo) {
    serviceName := strings.Split(n.Name, ".")[0]
    version := n.Version

    found := false
    for _, routeRule := range info.routeRules {
        if kubernetes.CheckRouteRule(routeRule, namespaceName, serviceName, version) {
            n.Metadata["hasRouteRule"] = "true"
            found = true
            break
        }
    }

    // If we have found a RouteRule we don't continue searching
    if !found {
        subsets := kubernetes.GetDestinationRulesSubsets(info.destinationRules, serviceName, version)
        for _, virtualService := range info.virtualServices {
            if kubernetes.CheckVirtualService(virtualService, namespaceName, serviceName, subsets) {
                n.Metadata["hasRouteRule"] = "true"
                break
            }
        }
    }
}
