package virtual_services

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
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

func (in SingleHostChecker) Check() models.IstioValidations {
	hostCounter := make(map[string]map[string]map[string]bool)
	validations := models.IstioValidations{}

	for _, vs := range in.VirtualServices {
		if hosts, ok := getHost(vs); ok {
			for _, host := range hosts {
				if len(hostCounter) > 0 {
					if isSameHost(hostCounter, host) {
						multipleVirtualServiceCheck(vs, validations)
					} else if isNamespaceWildcard(hostCounter, host) {
						multipleVirtualServiceCheck(vs, validations)
					} else if isFullWildcard(hostCounter, host) {
						multipleVirtualServiceCheck(vs, validations)
					}
				}

				storeHost(hostCounter, host)
			}
		}
	}

	return validations
}

func multipleVirtualServiceCheck(virtualService kubernetes.IstioObject, validations models.IstioValidations) {
	virtualServiceName := virtualService.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: virtualServiceName, ObjectType: "virtualservice"}
	checks := models.BuildCheck("More than one Virtual Service for same host",
		"warning", "spec/hosts")
	rrValidation := &models.IstioValidation{
		Name:       virtualServiceName,
		ObjectType: "virtualservice",
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
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

func getHost(virtualService kubernetes.IstioObject) ([]Host, bool) {
	hosts := virtualService.GetSpec()["hosts"]
	if hosts == nil {
		return []Host{}, false
	}

	slice := reflect.ValueOf(hosts)
	if slice.Kind() != reflect.Slice {
		return []Host{}, false
	}

	targetHosts := make([]Host, 0, slice.Len())

	for hostIdx := 0; hostIdx < slice.Len(); hostIdx++ {
		hostName, ok := slice.Index(hostIdx).Interface().(string)
		if !ok {
			continue
		}

		targetHosts = append(targetHosts, formatHostForSearch(hostName, virtualService.GetObjectMeta().Namespace))
	}

	return targetHosts, true
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
