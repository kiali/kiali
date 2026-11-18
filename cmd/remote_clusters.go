package cmd

// This file is deliberately NOT tagged `//go:build !exclude_frontend`: it is pure backend
// logic with no dependency on the embedded frontend, and keeping it untagged lets its tests
// run under `make test`, which builds with -tags exclude_frontend (the same reason
// cmd/access.go is untagged).

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"maps"
	"net"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/cluster"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// remoteCacheSyncTimeout bounds how long startup waits for the remote clusters' caches to sync
// before continuing without them. It is sized against the pod's startup probe budget: helm and
// the operator default to initial_delay 30s / period 10s / failure_threshold 6 (~90s), so a
// longer wait would have the kubelet restart Kiali before /healthz is served - recreating the
// crash loop through the back door. A remote that has not synced by then keeps syncing in the
// background; its reads fail (bounded by the cache read timeout) until it does.
const remoteCacheSyncTimeout = 45 * time.Second

// remoteProbeTimeout bounds the startup credentials probe of one remote cluster. Nothing else
// bounds it at this point in startup, and a remote that accepts connections but stalls would
// otherwise block startup far past every downstream budget.
const remoteProbeTimeout = 10 * time.Second

// cacheTransforms returns the per-type cache transforms shared across all clusters.
// These strip cached objects down to only the fields Kiali uses, significantly reducing
// memory consumption in large meshes.
//
// NOTE: every type listed here must be statically answerable by
// kubernetes.NewStaticFallbackMapper (see the sync test in remote_clusters_test.go): the
// controller-runtime cache constructor resolves whether each ByObject type is namespaced
// through the RESTMapper at construction time, which is what forces discovery against the
// remote. The static answers are what let cluster.New succeed while the remote is down.
func cacheTransforms() map[client.Object]ctrlcache.ByObject {
	return map[client.Object]ctrlcache.ByObject{
		&corev1.Pod{}:     {Transform: cache.TransformPod},
		&corev1.Service{}: {Transform: cache.TransformService},
	}
}

// newRemoteCluster builds the controller-runtime cluster (cache + client) for one remote.
// Construction is offline: the static-fallback mapper answers the ByObject types without
// contacting the remote, so a remote that is unreachable or has invalid credentials does not
// fail here. The returned cluster's cache is NOT added to a manager - see setupRemoteClusters.
func newRemoteCluster(conf *config.Config, saClient kubernetes.ClientInterface, clusterAccess *cache.ClusterAccess, scheme *runtime.Scheme) (cluster.Cluster, error) {
	clusterName := saClient.ClusterInfo().Name

	// Copy the config: the dial timeout set below must stay confined to the informer config.
	// client-go's transport cache keys on a DialHolder pointer that TransportConfig allocates
	// fresh on every call, so any config with a Dial set fragments transport pooling across
	// clientsets - acceptable here (watches hold dedicated connections anyway) but not
	// something to leak into the shared config that every K8SClient is built from.
	remoteConfig := rest.CopyConfig(saClient.ClusterInfo().ClientConfig)
	if dialTimeout := conf.KialiInternal.KubernetesClient.DialTimeout; dialTimeout > 0 && remoteConfig.Dial == nil {
		remoteConfig.Dial = (&net.Dialer{Timeout: dialTimeout}).DialContext
	}

	var remoteCluster cluster.Cluster
	remoteCluster, err := cluster.New(remoteConfig, func(o *cluster.Options) {
		o.Scheme = scheme
		// The static-fallback mapper keeps construction offline and bounds the lazy
		// discovery that happens later, on first use.
		o.MapperProvider = kubernetes.NewStaticFallbackMapper
		// Scope the remote cache the same way as the home cache (see cacheNamespaces).
		o.Cache.DefaultNamespaces = cacheNamespaces(conf, clusterName)
		o.Cache.DefaultTransform = ctrlcache.TransformStripManagedFields()
		o.Cache.ByObject = cacheTransforms()
		o.Cache.DefaultWatchErrorHandler = makeWatchErrorHandler(
			func() ctrlcache.Cache {
				if remoteCluster == nil {
					return nil
				}
				return remoteCluster.GetCache()
			},
			saClient,
			clusterAccess,
		)
	})
	if err != nil {
		return nil, err
	}
	return remoteCluster, nil
}

// remoteProbeVerdict is what startup does with a remote cluster whose credentials probe
// failed. The distinction matters because "skip" is permanent until restart: only a remote
// whose registration is definitively broken may be skipped, never one that is merely having
// a transient problem, which recovers on its own through the informer retry machinery.
type remoteProbeVerdict int

const (
	// remoteKeepTransient means the problem may resolve on its own: the cluster is kept and
	// self-heals. This is also the verdict for a successful probe.
	remoteKeepTransient remoteProbeVerdict = iota
	// remoteSkipAuth means the remote rejected Kiali's credentials: skip the cluster.
	remoteSkipAuth
	// remoteSkipConfig means the registration looks definitively misconfigured: skip the
	// cluster, with the raw error in the message.
	remoteSkipConfig
)

// probeRemoteCredentials asks the remote, through one cluster-scoped SelfSubjectAccessReview,
// whether it still accepts Kiali's credentials. The same call NewKialiCache and the #10523
// access-check machinery rely on, so it is safe in non-cluster-wide-access mode; an SSAR that
// succeeds with allowed=false is normal there and is NOT a credentials failure - only the
// error is classified. The verdict is about the transport and the credentials, not the RBAC.
func probeRemoteCredentials(ctx context.Context, client kubernetes.ClientInterface) error {
	probeCtx, cancel := context.WithTimeout(ctx, remoteProbeTimeout)
	defer cancel()
	_, err := client.GetSelfSubjectAccessReview(probeCtx, "", "apps", "deployments", []string{"list"})
	return err
}

// classifyRemoteProbeError decides what startup does with a failed credentials probe.
func classifyRemoteProbeError(err error) remoteProbeVerdict {
	switch {
	case err == nil:
		return remoteKeepTransient
	case apierrors.IsUnauthorized(err):
		// The remote rejected the token itself: definitive, and unfixable without editing
		// the remote cluster secret (which is only read at startup).
		return remoteSkipAuth
	case apierrors.IsForbidden(err):
		// The token authenticated - the credentials are valid; only the review endpoint is
		// denied. Keep the cluster (its data may be perfectly readable) and let the caller
		// note that revocation detection is limited.
		return remoteKeepTransient
	case isTLSError(err):
		// A bad CA bundle or wrong server name is a definitive registration problem. This
		// must be checked before the connection classes: client-go wraps TLS failures in
		// *url.Error, which itself implements net.Error, so a certificate problem would
		// otherwise look like a recoverable network failure and keep the broken cluster.
		return remoteSkipConfig
	case isConnectionError(err):
		// Unreachable, refused, DNS, timed out: possibly transient, and the informer retry
		// machinery recovers it without a restart.
		return remoteKeepTransient
	case apierrors.IsTooManyRequests(err), apierrors.IsServiceUnavailable(err),
		apierrors.IsInternalError(err), apierrors.IsServerTimeout(err), apierrors.IsTimeout(err):
		// Server-side trouble (an overloaded API server at startup must not require a
		// restart): keep.
		return remoteKeepTransient
	default:
		// Unclassifiable: fail clean (skip with the raw error) rather than keep a cluster
		// in an unknown state.
		return remoteSkipConfig
	}
}

// isConnectionError reports whether the error is a network-level failure (dial, DNS, EOF)
// as opposed to an API-level response.
func isConnectionError(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return true
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return true
	}
	return errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}

// isTLSError reports whether the error is a TLS handshake or certificate verification
// failure, which indicates a definitive configuration problem rather than a transient one.
func isTLSError(err error) bool {
	var certVerificationErr *tls.CertificateVerificationError
	if errors.As(err, &certVerificationErr) {
		return true
	}
	var unknownAuthorityErr x509.UnknownAuthorityError
	if errors.As(err, &unknownAuthorityErr) {
		return true
	}
	var hostnameErr x509.HostnameError
	if errors.As(err, &hostnameErr) {
		return true
	}
	var certInvalidErr x509.CertificateInvalidError
	return errors.As(err, &certInvalidErr)
}

// setupRemoteClusters builds, probes, and starts the caches of every configured remote
// cluster, returning the per-cluster caches of the clusters Kiali will serve. A remote whose
// registration is definitively broken (construction error, rejected credentials, TLS
// misconfiguration) is skipped through the client factory's skip registry, so every consumer
// built after this point (kiali cache, mesh discovery, business layer, auth controller)
// consistently does not see it. A remote that is merely unreachable is kept: its cache starts
// and its informers retry in the background, so it recovers without a restart once
// connectivity returns.
//
// The remote caches are started directly against ctx rather than added to the manager: the
// manager's runnable groups wait for every added cache to sync before starting controllers, so
// a never-syncing remote added via mgr.Add would block the home controllers (validations)
// forever. Kiali runs no controllers on remote clusters, so managing their lifecycle here is
// equivalent and cannot block the manager.
func setupRemoteClusters(ctx context.Context, conf *config.Config, clientFactory kubernetes.ClientFactory, clusterAccess *cache.ClusterAccess, scheme *runtime.Scheme) map[string]ctrlcache.Cache {
	homeCluster := conf.KubernetesConfig.ClusterName
	kubeCaches := map[string]ctrlcache.Cache{}

	// Construction is offline, so the serial loop is cheap; the probes are the slow part and
	// run concurrently below (remote counts are small, so no worker cap is needed - a capped
	// pool would process unreachable remotes in probe-timeout waves).
	type remote struct {
		client  kubernetes.ClientInterface
		cluster cluster.Cluster
	}
	remotes := map[string]remote{}
	for clusterName, saClient := range clientFactory.GetSAClients() {
		if clusterName == homeCluster {
			continue
		}
		remoteCluster, err := newRemoteCluster(conf, saClient, clusterAccess, scheme)
		if err != nil {
			log.Errorf("Unable to set up cache for remote cluster [%s]; skipping the cluster. Check the cluster's configuration and restart Kiali to recover. err=%v", clusterName, err)
			clientFactory.SkipCluster(clusterName, err)
			continue
		}
		remotes[clusterName] = remote{client: saClient, cluster: remoteCluster}
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	for clusterName, remoteCluster := range remotes {
		wg.Add(1)
		go func(clusterName string, remoteCluster remote) {
			defer wg.Done()
			probeErr := probeRemoteCredentials(ctx, remoteCluster.client)
			switch verdict := classifyRemoteProbeError(probeErr); verdict {
			case remoteSkipAuth:
				log.Errorf("Remote cluster [%s] rejected Kiali's credentials; skipping the cluster. Fix the kiali-multi-cluster-secret for this cluster and restart Kiali to recover. err=%v", clusterName, probeErr)
				clientFactory.SkipCluster(clusterName, probeErr)
				return
			case remoteSkipConfig:
				log.Errorf("Remote cluster [%s] could not be set up; skipping the cluster. Check the cluster's configuration/credentials and restart Kiali to recover. err=%v", clusterName, probeErr)
				clientFactory.SkipCluster(clusterName, probeErr)
				return
			case remoteKeepTransient:
				if probeErr != nil {
					if apierrors.IsForbidden(probeErr) {
						log.Warningf("Remote cluster [%s] denies Kiali's self-subject access reviews; credentials are valid and the cluster is kept, but revocation detection for it is limited. err=%v", clusterName, probeErr)
					} else {
						log.Warningf("Remote cluster [%s] is unreachable or unavailable at startup; its cache will sync in the background once it recovers. err=%v", clusterName, probeErr)
					}
				}
			}

			mu.Lock()
			kubeCaches[clusterName] = remoteCluster.cluster.GetCache()
			mu.Unlock()
			go func() {
				if err := remoteCluster.cluster.GetCache().Start(ctx); err != nil {
					log.Errorf("Remote cluster [%s] cache stopped with error: %v", clusterName, err)
				}
			}()
		}(clusterName, remoteCluster)
	}
	wg.Wait()

	return kubeCaches
}

// waitForCachesToSync is the startup cache-sync barrier: the home cluster's cache is
// mandatory (startup waits without a bound and exits if it never syncs), while the remote
// clusters' wait runs in the background - the server starts serving as soon as the home
// cache is ready, so a remote that is still syncing (or never syncs; see
// setupRemoteClusters) cannot hold the server start behind the startup probe's budget.
// The informers sync on their own whether or not anyone waits for them; the background
// wait only surfaces when the remote caches become ready (or give up) in the logs. Reads
// from an unsynced remote fail (bounded by the cache read timeout) until it syncs.
func waitForCachesToSync(ctx context.Context, kubeCaches map[string]ctrlcache.Cache, homeCluster string) {
	log.Infof("Waiting for cluster: %s cache to sync", homeCluster)
	homeCache, found := kubeCaches[homeCluster]
	if !found {
		log.Fatalf("No cache configured for home cluster [%s]", homeCluster)
	}
	if !homeCache.WaitForCacheSync(ctx) {
		log.Fatal("Timed out waiting for cache to sync")
	}

	remoteCaches := maps.Clone(kubeCaches)
	maps.DeleteFunc(remoteCaches, func(cluster string, _ ctrlcache.Cache) bool {
		return cluster == homeCluster
	})
	if len(remoteCaches) > 0 {
		go func() {
			log.Infof("Waiting for %d remote cluster caches to sync (bounded by %s)", len(remoteCaches), remoteCacheSyncTimeout)
			if unsynced := waitForCachesSync(ctx, remoteCaches, remoteCacheSyncTimeout); len(unsynced) > 0 {
				log.Warningf("Remote cluster caches did not sync within %s; reads from %v will fail until they sync.", remoteCacheSyncTimeout, unsynced)
			} else {
				log.Info("Remote cluster caches synced; all clusters are being served")
			}
		}()
	}
	log.Infof("Cluster [%s] cache synced; serving starts now (remote caches continue to sync in the background)", homeCluster)
}

// Start serving the home cluster before priming monitors that depend on remote reads.
func startServerAndMonitors(ctx context.Context, startServer func(), istioAPIEnabled bool, cpm business.ControlPlaneMonitor, discovery istio.MeshDiscovery, hcm business.HealthMonitor) {
	startServer()
	go func() {
		if istioAPIEnabled {
			cpm.PollIstiodForProxyStatus(ctx)
		} else if hcm != nil {
			if _, err := discovery.Mesh(ctx); err != nil {
				log.Warningf("Failed to prime cluster cache for health monitor: %s", err)
			}
		}
		if hcm != nil && ctx.Err() == nil {
			hcm.Start(ctx)
		}
	}()
}

// waitForCachesSync waits for all the given caches to sync, concurrently, under one shared
// deadline, and returns the names of the caches that had not synced when it expired. Unlike
// the manager's own barrier this never blocks indefinitely, which is what lets startup
// continue (and serve the healthy clusters) while a remote is still syncing.
func waitForCachesSync(ctx context.Context, kubeCaches map[string]ctrlcache.Cache, timeout time.Duration) []string {
	if len(kubeCaches) == 0 {
		return nil
	}
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var mu sync.Mutex
	unsynced := []string{}
	var wg sync.WaitGroup
	for clusterName, kubeCache := range kubeCaches {
		wg.Add(1)
		go func(clusterName string, kubeCache ctrlcache.Cache) {
			defer wg.Done()
			if !kubeCache.WaitForCacheSync(waitCtx) {
				mu.Lock()
				unsynced = append(unsynced, clusterName)
				mu.Unlock()
			}
		}(clusterName, kubeCache)
	}
	wg.Wait()
	return unsynced
}
