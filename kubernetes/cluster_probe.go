package kubernetes

import (
	"context"
	"time"
)

// ProbeClusterCredentials asks the cluster, through one cluster-scoped
// SelfSubjectAccessReview, whether it still accepts Kiali's credentials. The same
// cheap, always-allowed call serves both the startup credentials probe and the
// unreachable-cluster prober: an error-free or API-level answer proves the cluster is
// reachable, while a transport-level failure (see IsConnectionError) means it is not.
// The review is safe in non-cluster-wide-access mode: an SSAR that succeeds with
// allowed=false is normal there and is not a credentials failure - only the error is
// classified. The verdict is about the transport and the credentials, not the RBAC.
// The probe is bounded by the given timeout (kiali_internal.kubernetes_client.
// cluster_probe_timeout; <= 0 disables the bound); the caller's context still applies.
func ProbeClusterCredentials(ctx context.Context, client ClientInterface, timeout time.Duration) error {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	_, err := client.GetSelfSubjectAccessReview(ctx, "", "apps", "deployments", []string{"list"})
	return err
}
