package kubernetes

import (
	"context"
	"time"
)

// clusterProbeTimeout bounds one probe. Nothing else bounds the call at the points
// where it runs (startup, the background prober), and a remote that accepts
// connections but stalls would otherwise block far past every downstream budget.
const clusterProbeTimeout = 10 * time.Second

// ProbeClusterCredentials asks the cluster, through one cluster-scoped
// SelfSubjectAccessReview, whether it still accepts Kiali's credentials. The same
// cheap, always-allowed call serves both the startup credentials probe and the
// unreachable-cluster prober: an error-free or API-level answer proves the cluster is
// reachable, while a transport-level failure (see IsConnectionError) means it is not.
// The review is safe in non-cluster-wide-access mode: an SSAR that succeeds with
// allowed=false is normal there and is not a credentials failure - only the error is
// classified. The probe is bounded by clusterProbeTimeout (the caller's context
// still applies).
func ProbeClusterCredentials(ctx context.Context, client ClientInterface) error {
	probeCtx, cancel := context.WithTimeout(ctx, clusterProbeTimeout)
	defer cancel()
	_, err := client.GetSelfSubjectAccessReview(probeCtx, "", "apps", "deployments", []string{"list"})
	return err
}
