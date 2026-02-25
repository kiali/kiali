package mcputil

import (
	"context"
	"errors"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
)

var ErrWorkloadHasNoPods = errors.New("workload has no pods")

type ResolvePodOptions struct {
	// PreferRunning selects a Running pod first.
	PreferRunning bool
	// PreferNonProxyOnly selects a pod that has at least one non-proxy container.
	PreferNonProxyOnly bool
	// RequirePods returns ErrWorkloadHasNoPods if the workload exists but has no pods.
	RequirePods bool
	// FallbackToPodOnError falls back to treating the input as a pod name when workload lookup errors (non-NotFound).
	FallbackToPodOnError bool
}

type ResolvePodResult struct {
	PodName       string
	Pod           *models.Pod
	ResolvedFrom  string // "workload" | "pod"
	WorkloadFound bool
}

// ResolvePodFromWorkloadOrPod attempts to resolve the input as a workload first (if workloadName is provided).
// If that fails (workload not found), it falls back to the pod name.
func ResolvePodFromWorkloadOrPod(
	ctx context.Context,
	businessLayer *business.Layer,
	cluster, namespace, workloadName, podName string,
	queryTime time.Time,
	opts ResolvePodOptions,
) (ResolvePodResult, error) {
	wl := strings.TrimSpace(workloadName)
	pod := strings.TrimSpace(podName)

	fallback := func() (ResolvePodResult, error) {
		name := pod
		if name == "" {
			name = wl
		}
		return ResolvePodResult{PodName: name, ResolvedFrom: "pod"}, nil
	}

	if wl == "" {
		return fallback()
	}
	if businessLayer == nil {
		return fallback()
	}

	criteria := business.WorkloadCriteria{
		Cluster:               cluster,
		Namespace:             namespace,
		WorkloadName:          wl,
		WorkloadGVK:           schema.GroupVersionKind{Group: "", Version: "", Kind: ""},
		IncludeHealth:         false,
		IncludeIstioResources: false,
		IncludeServices:       false,
		QueryTime:             queryTime,
		RateInterval:          "10m",
	}
	wk, err := businessLayer.Workload.GetWorkload(ctx, criteria)
	if err != nil {
		// Not found: treat as a pod name.
		if k8serrors.IsNotFound(err) {
			return fallback()
		}
		// Non-NotFound errors: callers can decide whether to surface or fallback.
		if opts.FallbackToPodOnError {
			return fallback()
		}
		return ResolvePodResult{}, err
	}

	if wk == nil {
		return fallback()
	}

	pods := wk.Pods
	if len(pods) == 0 {
		if opts.RequirePods {
			return ResolvePodResult{WorkloadFound: true, ResolvedFrom: "workload"}, ErrWorkloadHasNoPods
		}
		return fallback()
	}

	selected := pickPodFromList(pods, opts)
	if selected == nil || selected.Name == "" {
		if opts.RequirePods {
			return ResolvePodResult{WorkloadFound: true, ResolvedFrom: "workload"}, ErrWorkloadHasNoPods
		}
		return fallback()
	}

	return ResolvePodResult{
		PodName:       selected.Name,
		Pod:           selected,
		ResolvedFrom:  "workload",
		WorkloadFound: true,
	}, nil
}

func pickPodFromList(pods models.Pods, opts ResolvePodOptions) *models.Pod {
	// 1) Running + non-proxy-only
	if opts.PreferRunning && opts.PreferNonProxyOnly {
		for _, p := range pods {
			if p != nil && strings.EqualFold(p.Status, "Running") && hasNonProxyContainers(p) {
				return p
			}
		}
	}
	// 2) Running
	if opts.PreferRunning {
		for _, p := range pods {
			if p != nil && strings.EqualFold(p.Status, "Running") {
				return p
			}
		}
	}
	// 3) Any non-proxy-only
	if opts.PreferNonProxyOnly {
		for _, p := range pods {
			if p != nil && hasNonProxyContainers(p) {
				return p
			}
		}
	}
	// 4) First
	for _, p := range pods {
		if p != nil && p.Name != "" {
			return p
		}
	}
	return nil
}

func hasNonProxyContainers(pod *models.Pod) bool {
	if pod == nil {
		return false
	}
	for _, c := range pod.Containers {
		if c != nil && c.Name != "" && c.Name != models.IstioProxy {
			return true
		}
	}
	return false
}
