package models

// CanaryUpgradeStatus contains the namespaces that are part of the canary and the namespaces that are still using the current revision
type CanaryUpgradeStatus struct {
	NamespacesPerRevision map[string][]string `json:"namespacesPerRevision"`
}
