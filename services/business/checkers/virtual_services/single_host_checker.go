package virtual_services

import (
	"fmt"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"reflect"
	"strings"
)

type SingleHostChecker struct {
	Namespace       string
	VirtualServices []kubernetes.IstioObject
}

type Host struct {
	Service   string
	Namespace string
	Cluster   string
}

func (in SingleHostChecker) Check() ([]*models.IstioCheck, bool) {
	hostCounter := make(map[string]map[string]map[string]bool)
	validations := make([]*models.IstioCheck, 0)

	for _, vs := range in.VirtualServices {
		if host, ok := getHost(vs); ok {
			if len(hostCounter) > 0 {
				if isSameHost(hostCounter, host) {
					return multipleVirtualServiceCheck(), false
				} else if isNamespaceWildcard(hostCounter, host) {
					return multipleVirtualServiceCheck(), false
				} else if isFullWildcard(hostCounter, host) {
					return multipleVirtualServiceCheck(), false
				}
			}

			storeHost(hostCounter, host)
		}
	}

	return validations, true
}

func multipleVirtualServiceCheck() []*models.IstioCheck {
	validation := models.BuildCheck("More than one Virtual Service for same host",
		"warning", "spec/hosts")
	return []*models.IstioCheck{&validation}

}

func storeHost(hostCounter map[string]map[string]map[string]bool, host Host) {
	if hostCounter[host.Cluster] == nil {
		hostCounter[host.Cluster] = map[string]map[string]bool{
			host.Namespace: {
				host.Service: true,
			},
		}
	} else if hostCounter[host.Cluster][host.Namespace] == nil {
		hostCounter[host.Cluster][host.Namespace] = map[string]bool{
			host.Service: true,
		}
	} else if hostCounter[host.Cluster][host.Namespace] != nil {
		hostCounter[host.Cluster][host.Namespace][host.Service] = true
	} else if hostCounter[host.Cluster][host.Namespace][host.Service] {
		fmt.Errorf("SHOULDNT HAPPEN")

	}
}

func isSameHost(hostCounter map[string]map[string]map[string]bool, host Host) bool {
	return hostCounter[host.Cluster] != nil && hostCounter[host.Cluster][host.Namespace] != nil &&
		hostCounter[host.Cluster][host.Namespace][host.Service]
}

func isNamespaceWildcard(hostCounter map[string]map[string]map[string]bool, host Host) bool {
	if host.Service == "*" && host.Namespace != "*" {
		return hostCounter[host.Cluster] != nil &&
			hostCounter[host.Cluster][host.Namespace] != nil &&
			len(hostCounter[host.Cluster][host.Namespace]) > 0
	} else if host.Service != "*" {
		return hostCounter[host.Cluster] != nil &&
			hostCounter[host.Cluster][host.Namespace] != nil &&
			hostCounter[host.Cluster][host.Namespace]["*"]
	}

	return false
}

func isFullWildcard(hostCounter map[string]map[string]map[string]bool, host Host) bool {
	if host.Service == "*" && host.Namespace == "*" {
		return len(hostCounter) > 0
	}

	return false
}

func getHost(virtualService kubernetes.IstioObject) (Host, bool) {
	host := Host{}
	hosts := virtualService.GetSpec()["hosts"]
	if hosts == nil {
		return host, false
	}

	// Getting a []HTTPRoute
	slice := reflect.ValueOf(hosts)
	if slice.Kind() != reflect.Slice {
		return host, false
	}

	for hostIdx := 0; hostIdx < slice.Len(); hostIdx++ {
		if hostIdx > 1 {
			break
		}

		hostName, ok := slice.Index(hostIdx).Interface().(string)
		if !ok {
			continue
		}

		host = formatHostForSearch(hostName, virtualService.GetObjectMeta().Namespace)
	}

	return host, true
}

// Convert host to Host struct for searching
// e.g. reviews -> reviews, virtualService.Namespace, svc.cluster.local
// e.g. reviews.bookinfo.svc.cluster.local -> reviews, bookinfo, svc.cluster.local
// e.g. *.bookinfo.svc.cluster.local -> *, bookinfo, svc.cluster.local
// e.g. * -> *, *, *
func formatHostForSearch(hostName, virtualServiceNamespace string) Host {
	domainParts := strings.Split(hostName, ".")
	host := Host{}

	host.Service = domainParts[0]
	if len(domainParts) > 1 {
		host.Namespace = domainParts[1]

		if len(domainParts) > 2 {
			host.Cluster = strings.Join(domainParts[2:], ".")
		}
	} else if host.Service != "*" {
		host.Namespace = virtualServiceNamespace
		host.Cluster = "svc.cluster.local"
	} else if host.Service == "*" {
		host.Namespace = "*"
		host.Cluster = "*"
	}

	return host
}
