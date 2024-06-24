package validations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"gopkg.in/yaml.v2"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type FixtureLoader interface {
	Load() error
	GetNamespaces()
	GetResources() models.IstioConfigList
}

type YamlFixtureLoader struct {
	Filename string
	loaded   bool

	// Used for any namespace, only for testing
	istioConfigList models.IstioConfigList
	namespaces      []core_v1.Namespace
}

func (l *YamlFixtureLoader) Load() error {
	yamlFile, err := os.ReadFile(l.Filename)
	l.istioConfigList = models.IstioConfigList{}
	if err != nil {
		log.Errorf("Error loading test file: #%v ", err)
		return err
	}

	r := bytes.NewReader(yamlFile)
	dec := yaml.NewDecoder(r)

	for {
		var value interface{}
		err := dec.Decode(&value)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		value = cleanUpMapValue(value)
		if mValue, ok := value.(map[string]interface{}); ok {
			if iKind, ok := mValue["kind"]; ok {
				if kind, ok := iKind.(string); ok {
					bValue, err := json.Marshal(value)
					if err != nil {
						return err
					}
					switch kind {
					case "DestinationRule":
						dr := networking_v1.DestinationRule{}
						err = json.Unmarshal(bValue, &dr)
						l.istioConfigList.DestinationRules = append(l.istioConfigList.DestinationRules, &dr)
					case "EnvoyFilter":
						ef := networking_v1alpha3.EnvoyFilter{}
						err = json.Unmarshal(bValue, &ef)
						l.istioConfigList.EnvoyFilters = append(l.istioConfigList.EnvoyFilters, &ef)
					case "Gateway":
						gw := networking_v1.Gateway{}
						err = json.Unmarshal(bValue, &gw)
						l.istioConfigList.Gateways = append(l.istioConfigList.Gateways, &gw)
					case "ServiceEntry":
						se := networking_v1.ServiceEntry{}
						err = json.Unmarshal(bValue, &se)
						l.istioConfigList.ServiceEntries = append(l.istioConfigList.ServiceEntries, &se)
					case "Sidecar":
						sc := networking_v1.Sidecar{}
						err = json.Unmarshal(bValue, &sc)
						l.istioConfigList.Sidecars = append(l.istioConfigList.Sidecars, &sc)
					case "VirtualService":
						vs := networking_v1.VirtualService{}
						err = json.Unmarshal(bValue, &vs)
						l.istioConfigList.VirtualServices = append(l.istioConfigList.VirtualServices, &vs)
					case "WorkloadEntry":
						we := networking_v1.WorkloadEntry{}
						err = json.Unmarshal(bValue, &we)
						l.istioConfigList.WorkloadEntries = append(l.istioConfigList.WorkloadEntries, &we)
					case "WorkloadGroup":
						wg := networking_v1.WorkloadGroup{}
						err = json.Unmarshal(bValue, &wg)
						l.istioConfigList.WorkloadGroups = append(l.istioConfigList.WorkloadGroups, &wg)
					case "AuthorizationPolicy":
						ap := security_v1.AuthorizationPolicy{}
						err = json.Unmarshal(bValue, &ap)
						l.istioConfigList.AuthorizationPolicies = append(l.istioConfigList.AuthorizationPolicies, &ap)
					case "PeerAuthentication":
						pa := security_v1.PeerAuthentication{}
						err = json.Unmarshal(bValue, &pa)
						l.istioConfigList.PeerAuthentications = append(l.istioConfigList.PeerAuthentications, &pa)
					case "RequestAuthentication":
						ra := security_v1.RequestAuthentication{}
						err = json.Unmarshal(bValue, &ra)
						l.istioConfigList.RequestAuthentications = append(l.istioConfigList.RequestAuthentications, &ra)
					case "Namespace":
						na := core_v1.Namespace{}
						err = json.Unmarshal(bValue, &na)
						l.namespaces = append(l.namespaces, na)
					}
					if err != nil {
						return err
					}
				}
			}
		}
	}
	l.loaded = true

	return nil
}

func (l YamlFixtureLoader) GetNamespaces() []core_v1.Namespace {
	return l.namespaces
}

func (l YamlFixtureLoader) GetResources() models.IstioConfigList {
	return l.istioConfigList
}

func (l YamlFixtureLoader) FindAuthorizationPolicy(name, namespace string) *security_v1.AuthorizationPolicy {
	for _, a := range l.istioConfigList.AuthorizationPolicies {
		if a.Name == name && a.Namespace == namespace {
			return a
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindDestinationRule(name, namespace string) *networking_v1.DestinationRule {
	for _, d := range l.istioConfigList.DestinationRules {
		if d.Name == name && d.Namespace == namespace {
			return d
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindVirtualService(name, namespace string) *networking_v1.VirtualService {
	for _, v := range l.istioConfigList.VirtualServices {
		if v.Name == name && v.Namespace == namespace {
			return v
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindVirtualServiceIn(namespace string) []*networking_v1.VirtualService {
	vs := []*networking_v1.VirtualService{}
	for _, v := range l.istioConfigList.VirtualServices {
		if v.Namespace == namespace {
			vs = append(vs, v)
		}
	}
	return vs
}

func (l YamlFixtureLoader) FindServiceEntry(name, namespace string) *networking_v1.ServiceEntry {
	for _, v := range l.istioConfigList.ServiceEntries {
		if v.Name == name && v.Namespace == namespace {
			return v
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindWorkloadEntry(name, namespace string) *networking_v1.WorkloadEntry {
	for _, v := range l.istioConfigList.WorkloadEntries {
		if v.Name == name && v.Namespace == namespace {
			return v
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindSidecar(name, namespace string) *networking_v1.Sidecar {
	for _, v := range l.istioConfigList.Sidecars {
		if v.Name == name && v.Namespace == namespace {
			return v
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindPeerAuthentication(name, namespace string) *security_v1.PeerAuthentication {
	for _, p := range l.istioConfigList.PeerAuthentications {
		if p.Name == name && p.Namespace == namespace {
			return p
		}
	}
	return nil
}

func (l YamlFixtureLoader) FindPeerAuthenticationIn(namespace string) []*security_v1.PeerAuthentication {
	pa := []*security_v1.PeerAuthentication{}
	for _, p := range l.istioConfigList.PeerAuthentications {
		if p.Namespace == namespace {
			pa = append(pa, p)
		}
	}
	return pa
}

func (l YamlFixtureLoader) FindPeerAuthenticationNotIn(namespace string) []*security_v1.PeerAuthentication {
	pa := []*security_v1.PeerAuthentication{}
	for _, p := range l.istioConfigList.PeerAuthentications {
		if p.Namespace != namespace {
			pa = append(pa, p)
		}
	}
	return pa
}

func (l YamlFixtureLoader) FindDestinationRuleIn(namespace string) []*networking_v1.DestinationRule {
	dr := []*networking_v1.DestinationRule{}
	for _, d := range l.istioConfigList.DestinationRules {
		if d.Namespace == namespace {
			dr = append(dr, d)
		}
	}
	return dr
}

func (l YamlFixtureLoader) FindDestinationRuleNotIn(namespace string) []*networking_v1.DestinationRule {
	dr := []*networking_v1.DestinationRule{}
	for _, d := range l.istioConfigList.DestinationRules {
		if d.Namespace != namespace {
			dr = append(dr, d)
		}
	}
	return dr
}

// Needed due to Yaml.Decode default map type is map[interface{}]interface{}
// We need to convert it to map[string]interface{} to be compliant with real Istio Objects.
// Known issue: https://github.com/go-yaml/yaml/issues/139

func cleanUpInterfaceArray(in []interface{}) []interface{} {
	result := make([]interface{}, len(in))
	for i, v := range in {
		result[i] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpInterfaceMap(in map[interface{}]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range in {
		result[fmt.Sprintf("%v", k)] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpStringInterfaceMap(in map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range in {
		result[k] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpMapValue(v interface{}) interface{} {
	switch v := v.(type) {
	case []interface{}:
		return cleanUpInterfaceArray(v)
	case map[interface{}]interface{}:
		return cleanUpInterfaceMap(v)
	case map[string]interface{}:
		return cleanUpStringInterfaceMap(v)
	default:
		return v
	}
}
