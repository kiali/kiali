package models

import (
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

// A Namespace provide a scope for names
// This type is used to describe a set of objects.
//
// swagger:model namespace
type Namespace struct {
	// The id of the namespace.
	//
	// example:  istio-system
	// required: true
	Name string `json:"name"`

	// The name of the cluster
	//
	// example:  east
	// required: true
	Cluster string `json:"cluster"`

	// If has the Ambient annotations
	//
	// required: true
	IsAmbient bool `json:"isAmbient"`

	// Creation date of the namespace.
	// There is no need to export this through the API. So, this is
	// set to be ignored by JSON package.
	//
	// required: true
	CreationTimestamp time.Time `json:"-"`

	// Labels for Namespace
	Labels map[string]string `json:"labels"`

	// Specific annotations used in Kiali
	Annotations map[string]string `json:"annotations"`

	// Revision managing this namespace.
	// If the namespace has 'istio-injection: enabled' label,
	// it will be set to the 'default' revision. Otherwise
	// it matches on istio.io/rev. Note that his can also
	// be a Tag and not the actual revision.
	Revision string `json:"revision,omitempty"`
}

type (
	Namespaces     []Namespace
	NamespaceNames []string
)

func CastNamespaceCollection(ns []core_v1.Namespace, cluster string) []Namespace {
	namespaces := make([]Namespace, len(ns))
	for i, item := range ns {
		namespaces[i] = CastNamespace(item, cluster)
	}

	return namespaces
}

func CastNamespace(ns core_v1.Namespace, cluster string) Namespace {
	istioLabels := config.Get().IstioLabels

	namespace := Namespace{}
	namespace.Name = ns.Name
	namespace.Cluster = cluster
	namespace.CreationTimestamp = ns.CreationTimestamp.Time
	namespace.Labels = ns.Labels
	namespace.Annotations = ns.Annotations

	if ns.Labels != nil {
		// Injection label takes precedence.
		// See rules at: https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/#controlling-the-injection-policy
		if injectionLabel := ns.Labels[IstioInjectionLabel]; injectionLabel == IstioInjectionDisabledLabelValue {
			namespace.Revision = ""
		} else if injectionLabel == IstioInjectionEnabledLabelValue {
			namespace.Revision = DefaultRevisionLabel
		} else if label, hasLabel := ns.Labels[config.IstioRevisionLabel]; hasLabel {
			namespace.Revision = label
		}
	}

	if label, hasLabel := ns.Labels[istioLabels.AmbientNamespaceLabel]; hasLabel && label == istioLabels.AmbientNamespaceLabelValue {
		namespace.IsAmbient = true
	}
	return namespace
}

func CastProjectCollection(ps []osproject_v1.Project, cluster string) []Namespace {
	namespaces := make([]Namespace, len(ps))
	for i, project := range ps {
		namespaces[i] = CastProject(project, cluster)
	}

	return namespaces
}

func CastProject(p osproject_v1.Project, cluster string) Namespace {
	istioLabels := config.Get().IstioLabels
	namespace := Namespace{}
	namespace.Name = p.Name
	namespace.Cluster = cluster
	namespace.CreationTimestamp = p.CreationTimestamp.Time
	namespace.Labels = p.Labels
	namespace.Annotations = p.Annotations
	if p.Labels[istioLabels.AmbientNamespaceLabel] == istioLabels.AmbientNamespaceLabelValue {
		namespace.IsAmbient = true
	}
	return namespace
}

func (nss Namespaces) Includes(namespace string) bool {
	for _, ns := range nss {
		if ns.Name == namespace {
			return true
		}
	}
	return false
}

func (nss Namespaces) IsNamespaceAmbient(namespace, cluster string) bool {
	for _, ns := range nss {
		if ns.Name == namespace && ns.Cluster == cluster {
			return ns.IsAmbient
		}
	}
	return false
}

func (nss Namespaces) GetNamespace(namespace, cluster string) *Namespace {
	for _, ns := range nss {
		if ns.Name == namespace && ns.Cluster == cluster {
			return &ns
		}
	}
	return nil
}

func (nss Namespaces) GetNames() []string {
	names := make([]string, len(nss))
	for _, ns := range nss {
		names = append(names, ns.Name)
	}
	return names
}

func (nsn NamespaceNames) Includes(namespace string) bool {
	for _, ns := range nsn {
		if ns == namespace {
			return true
		}
	}
	return false
}

func (a NamespaceNames) IsSubsetOf(b NamespaceNames) bool {
	isSubset := true
	for _, n := range b {
		isSubset = isSubset && b.Includes(n)
	}
	return isSubset
}
