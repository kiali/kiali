package models

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/kiali/kiali/config"
)

const (
	WaypointRoleCanary  = "canary"
	WaypointRolePrimary = "primary"
)

// WaypointTrafficSplit describes primary and optional canary waypoint gateways for a resource.
type WaypointTrafficSplit struct {
	CanaryWeight int `json:"canaryWeight"`
	// ConfigLevel is namespace or service (where the canary labels apply).
	ConfigLevel string `json:"configLevel,omitempty"`
	// Primary share of new mesh connections (0-100); remainder goes to canary when canary is set.
	PrimaryWeight int              `json:"primaryWeight"`
	Canary        *WaypointBinding `json:"canary,omitempty"`
	Primary       WaypointBinding  `json:"primary"`
}

// WaypointBinding references a waypoint gateway workload.
type WaypointBinding struct {
	Cluster   string `json:"cluster"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Role      string `json:"role"`
}

// ParseWaypointCanaryWeight parses istio.io/use-waypoint-canary-weight (0-100). Invalid values return -1.
func ParseWaypointCanaryWeight(annotations map[string]string) int {
	if annotations == nil {
		return 0
	}
	raw := strings.TrimSpace(annotations[config.WaypointCanaryWeightAnnotation])
	if raw == "" {
		return 0
	}
	weight, err := strconv.Atoi(raw)
	if err != nil || weight < 0 || weight > 100 {
		return -1
	}
	return weight
}

// ResolveWaypointTrafficSplit builds split config from labels and annotations at a single config level.
func ResolveWaypointTrafficSplit(cluster, defaultNamespace string, labels, annotations map[string]string, configLevel string) *WaypointTrafficSplit {
	if labels == nil {
		return nil
	}
	primaryName := labels[config.WaypointUseLabel]
	if primaryName == "" || primaryName == config.WaypointNone {
		return nil
	}
	primaryNs := labels[config.WaypointUseNamespaceLabel]
	if primaryNs == "" {
		primaryNs = defaultNamespace
	}

	split := &WaypointTrafficSplit{
		ConfigLevel: configLevel,
		Primary: WaypointBinding{
			Cluster:   cluster,
			Name:      primaryName,
			Namespace: primaryNs,
			Role:      WaypointRolePrimary,
		},
		CanaryWeight:  0,
		PrimaryWeight: 100,
	}

	canaryName := labels[config.WaypointCanaryUseLabel]
	if canaryName == "" {
		return split
	}
	canaryNs := labels[config.WaypointCanaryNamespaceLabel]
	if canaryNs == "" {
		canaryNs = defaultNamespace
	}
	weight := ParseWaypointCanaryWeight(annotations)
	if weight < 0 {
		return split
	}
	split.CanaryWeight = weight
	split.PrimaryWeight = 100 - weight
	split.Canary = &WaypointBinding{
		Cluster:   cluster,
		Name:      canaryName,
		Namespace: canaryNs,
		Role:      WaypointRoleCanary,
	}
	return split
}

// WaypointCanaryNodeLabel returns graph label text for a waypoint gateway workload.
func WaypointCanaryNodeLabel(workload, workloadNamespace string, split *WaypointTrafficSplit) string {
	if split == nil || split.Canary == nil || workload == "" {
		return ""
	}
	if split.Canary.Name == workload && split.Canary.Namespace == workloadNamespace {
		return fmt.Sprintf("Canary %d%%", split.CanaryWeight)
	}
	if split.Primary.Name == workload && split.Primary.Namespace == workloadNamespace {
		return fmt.Sprintf("Primary %d%%", split.PrimaryWeight)
	}
	return ""
}

// GatewayWaypointTrafficSplit returns split info when viewing a waypoint gateway workload named gatewayName.
func GatewayWaypointTrafficSplit(cluster, gatewayNamespace, gatewayName string, nsLabels, nsAnnotations map[string]string) *WaypointTrafficSplit {
	if nsLabels == nil {
		return nil
	}
	primary := nsLabels[config.WaypointUseLabel]
	canary := nsLabels[config.WaypointCanaryUseLabel]
	if primary != gatewayName && canary != gatewayName {
		return nil
	}
	split := ResolveWaypointTrafficSplit(cluster, gatewayNamespace, nsLabels, nsAnnotations, "namespace")
	if split == nil {
		return nil
	}
	if primary == gatewayName && canary == gatewayName {
		return split
	}
	if canary == gatewayName && split.Canary != nil {
		return split
	}
	if primary == gatewayName {
		return split
	}
	// This gateway is only the canary; rebuild with primary from namespace labels.
	if primary == "" || primary == config.WaypointNone {
		return nil
	}
	primaryNs := nsLabels[config.WaypointUseNamespaceLabel]
	if primaryNs == "" {
		primaryNs = gatewayNamespace
	}
	weight := ParseWaypointCanaryWeight(nsAnnotations)
	if weight < 0 {
		weight = 0
	}
	return &WaypointTrafficSplit{
		ConfigLevel:   "namespace",
		PrimaryWeight: 100 - weight,
		CanaryWeight:  weight,
		Primary: WaypointBinding{
			Cluster:   cluster,
			Name:      primary,
			Namespace: primaryNs,
			Role:      WaypointRolePrimary,
		},
		Canary: &WaypointBinding{
			Cluster:   cluster,
			Name:      gatewayName,
			Namespace: gatewayNamespace,
			Role:      WaypointRoleCanary,
		},
	}
}
