package models

import (
	"time"
)

// A Namespace provide a scope for names
// This type is used to describe a set of objects.
//
// swagger:model namespace
type CombinedNamespace struct {
	// The id of the namespace.
	//
	// example:  istio-system
	// required: true
	Name string `json:"name"`

	// The name of the cluster.
	// Empty when local
	//
	// example:  east
	// required: true
	Clusters []string `json:"clusters"`

	// Creation date of the namespace.
	// There is no need to export this through the API. So, this is
	// set to be ignored by JSON package.
	//
	// required: true
	CreationTimestamp time.Time `json:"-"`

	// Labels for Namespace
	Labels map[string][]string `json:"labels"`

	// Specific annotations used in Kiali
	Annotations map[string][]string `json:"annotations"`
}

type CombinedNamespaces []CombinedNamespace

func CombineNamespaces(ns1 Namespace, ns2 Namespace) CombinedNamespace {
	cNamespace := CombinedNamespace{}
	cNamespace.Name = ns1.Name

	cNamespace.Name = ns1.Name
	cNamespace.Clusters = []string{ns1.Cluster, ns2.Cluster}
	cNamespace.CreationTimestamp = ns1.CreationTimestamp

	for label, value := range ns1.Labels {
		cNamespace.Labels[label] = []string{value}
	}
	for label, value := range ns2.Labels {
		if len(cNamespace.Labels[label]) != 0 {
			cNamespace.Labels[label] = append(cNamespace.Labels[label], value)
		} else {
			cNamespace.Labels[label] = []string{value}
		}
	}

	for annotation, value := range ns1.Annotations {
		cNamespace.Annotations[annotation] = []string{value}
	}
	for annotation, value := range ns2.Annotations {
		if len(cNamespace.Annotations[annotation]) != 0 {
			cNamespace.Annotations[annotation] = append(cNamespace.Annotations[annotation], value)
		} else {
			cNamespace.Annotations[annotation] = []string{value}
		}
	}

	return cNamespace
}

func CastCombinedNamespace(ns1 Namespace) CombinedNamespace {
	cNamespace := CombinedNamespace{}
	cNamespace.Name = ns1.Name

	cNamespace.Name = ns1.Name
	cNamespace.Clusters = []string{ns1.Cluster}
	cNamespace.CreationTimestamp = ns1.CreationTimestamp

	for label, value := range ns1.Labels {
		if cNamespace.Labels == nil {
			cNamespace.Labels = make(map[string][]string)
		}
		cNamespace.Labels[label] = []string{value}
	}

	for annotation, value := range ns1.Annotations {
		if cNamespace.Annotations == nil {
			cNamespace.Annotations = make(map[string][]string)
		}
		cNamespace.Annotations[annotation] = []string{value}
	}

	return cNamespace
}

func CombineNs(ns1 CombinedNamespace, ns2 CombinedNamespace) CombinedNamespace {

	ns1.Clusters = append(ns1.Clusters, ns2.Clusters...)

	for label, value := range ns2.Labels {
		ns1.Labels[label] = append(ns1.Labels[label], value...)
	}

	for annotation, value := range ns2.Annotations {
		ns1.Annotations[annotation] = append(ns1.Annotations[annotation], value...)
	}

	return ns1
}

func CastCombinedNamespaceCollection(namespaces []Namespace) []CombinedNamespace {
	//var combined map[string]CombinedNamespace
	combined := make(map[string]CombinedNamespace)
	for _, ns := range namespaces {
		v, ok := combined[ns.Name]
		if ok {
			combined[ns.Name] = CombineNs(v, CastCombinedNamespace(ns))
		} else {
			combined[ns.Name] = CastCombinedNamespace(ns)
		}
	}

	var plainCombined []CombinedNamespace
	for _, ns := range combined {
		plainCombined = append(plainCombined, ns)
	}
	return plainCombined
}

func CastCombinedNamespaces(namespaces []Namespace) CombinedNamespaces {
	var combined CombinedNamespaces

	for _, ns := range namespaces {
		combined = append(combined, CastCombinedNamespace(ns))
	}

	return combined
}
