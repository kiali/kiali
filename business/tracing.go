package business

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

type (
	SpanFilter = func(span *jaegerModels.Span) bool
)

type TracingService struct {
	app       *AppService
	conf      *config.Config
	namespace *NamespaceService
	svc       *SvcService
	tracing   tracing.ClientInterface
	workload  *WorkloadService
}

func NewTracingService(conf *config.Config, tracing tracing.ClientInterface, svcService *SvcService, workloadService *WorkloadService, appService *AppService, namespaceService *NamespaceService) TracingService {
	return TracingService{
		app:       appService,
		conf:      conf,
		namespace: namespaceService,
		svc:       svcService,
		tracing:   tracing,
		workload:  workloadService,
	}
}

// buildTracingServiceName returns the service name to query the tracing
// backend. When NamespaceSelector is enabled and the name does not already
// contain the identity domain suffix, the name is formatted as "app|namespace".
func (in *TracingService) buildTracingServiceName(ctx context.Context, cluster, namespace, app string) string {
	identityDomain := in.svc.ResolveIdentityDomain(ctx, cluster)
	return tracingServiceName(in.conf.ExternalServices.Tracing.NamespaceSelector, identityDomain, namespace, app)
}

// tracingServiceName contains the pure logic for building a tracing service
// name so it can be unit-tested without requiring a full SvcService setup.
// Note: identityDomain is never empty in production (ResolveIdentityDomain
// always falls back to "svc.cluster.local"), but the empty-string guard
// keeps the function safe if called from tests or future callers.
func tracingServiceName(namespaceSelector bool, identityDomain, namespace, app string) string {
	if namespaceSelector && (identityDomain == "" || !strings.Contains(app, identityDomain)) {
		return util.BuildNameNSKey(app, namespace)
	}
	return app
}

func (in *TracingService) client() (tracing.ClientInterface, error) {
	if !in.conf.ExternalServices.Tracing.Enabled {
		return nil, fmt.Errorf("tracing is not enabled")
	}

	if in.tracing == nil {
		return nil, fmt.Errorf("tracing client is not initialized")
	}

	return in.tracing, nil
}

func (in *TracingService) getFilteredSpans(ctx context.Context, ns string, app models.TracingName, query models.TracingQuery, filter SpanFilter) ([]model.TracingSpan, error) {
	r, err := in.GetAppTraces(ctx, ns, app.Lookup, app.Lookup, query)
	if err != nil {
		return []model.TracingSpan{}, err
	}
	spans := tracesToSpans(ctx, app, r, filter, in.conf)

	return spans, nil
}

func (in *TracingService) GetAppSpans(ctx context.Context, cluster, ns, app string, query models.TracingQuery) ([]model.TracingSpan, error) {
	tracingName, err := in.app.GetAppTracingName(ctx, cluster, ns, app)
	if err != nil {
		return nil, err
	}
	var waypointFilter SpanFilter
	if tracingName.Lookup != app {
		waypointFilter = operationSpanFilter(ctx, ns, app)
	}
	return in.getFilteredSpans(ctx, ns, tracingName, query, waypointFilter)
}

func (in *TracingService) GetServiceSpans(ctx context.Context, ns, service string, query models.TracingQuery) ([]model.TracingSpan, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceSpans",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, query.Cluster),
		observability.Attribute("namespace", ns),
		observability.Attribute("service", service),
	)
	defer end()

	app, err := in.svc.GetServiceTracingName(ctx, query.Cluster, ns, service)
	if err != nil {
		return nil, err
	}
	var postFilter SpanFilter
	// Run post-filter only for service != app
	if app.Lookup != service {
		postFilter = operationSpanFilter(ctx, ns, service)
	}
	return in.getFilteredSpans(ctx, ns, app, query, postFilter)
}

func operationSpanFilter(ctx context.Context, ns, service string) SpanFilter {
	fqService := util.BuildNameNSKey(service, ns)
	// Filter out app spans based on operation name.
	// For envoy traces, operation name is like "service-name.namespace.svc.cluster.local:8000/*"
	return func(span *jaegerModels.Span) bool {
		// For ambient traces, use canonical service tags when available.
		if spanTagMatches(span, "istio.destination_canonical_service", "istio.destination_namespace", service, ns) ||
			spanTagMatches(span, "istio.source_canonical_service", "istio.source_namespace", service, ns) {
			return true
		}
		log.FromContext(ctx).Trace().Msgf("operationSpanFilter [%s] has prefix [%s]", span.OperationName, fqService)
		return strings.HasPrefix(span.OperationName, fqService)
	}
}

func spanTagValue(span *jaegerModels.Span, key string) (string, bool) {
	for _, tag := range span.Tags {
		if tag.Key != key {
			continue
		}
		if v, ok := tag.Value.(string); ok && v != "" {
			return v, true
		}
	}
	return "", false
}

func spanTagMatches(span *jaegerModels.Span, nameTag, namespaceTag, expectedName, expectedNamespace string) bool {
	name, nameFound := spanTagValue(span, nameTag)
	namespace, nsFound := spanTagValue(span, namespaceTag)
	if !nameFound || !nsFound {
		return false
	}
	return name == expectedName && namespace == expectedNamespace
}

func spanMatchesAmbientWorkload(span *jaegerModels.Span, workload, namespace string) bool {
	return spanTagMatches(span, "istio.destination_workload", "istio.destination_namespace", workload, namespace) ||
		spanTagMatches(span, "istio.source_workload", "istio.source_namespace", workload, namespace)
}

func spanHasAmbientWorkloadTags(span *jaegerModels.Span) bool {
	_, hasDestWorkload := spanTagValue(span, "istio.destination_workload")
	_, hasDestNamespace := spanTagValue(span, "istio.destination_namespace")
	_, hasSourceWorkload := spanTagValue(span, "istio.source_workload")
	_, hasSourceNamespace := spanTagValue(span, "istio.source_namespace")
	return (hasDestWorkload && hasDestNamespace) || (hasSourceWorkload && hasSourceNamespace)
}

func (in *TracingService) GetWorkloadSpans(ctx context.Context, ns, workload string, query models.TracingQuery) ([]model.TracingSpan, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetWorkloadSpans",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, query.Cluster),
		observability.Attribute("namespace", ns),
		observability.Attribute("workload", workload),
	)
	defer end()

	tracingName, err := in.workload.GetWorkloadTracingName(ctx, query.Cluster, ns, workload)
	if err != nil {
		return nil, err
	}
	return in.getFilteredSpans(ctx, ns, tracingName, query, wkdSpanFilter(ctx, ns, tracingName))
}

func wkdSpanFilter(ctx context.Context, ns string, tracingName models.TracingName) SpanFilter {
	// Filter out app traces based on the node_id tag, that contains workload information.
	return func(span *jaegerModels.Span) bool {
		return spanMatchesWorkload(ctx, span, ns, tracingName)
	}
}

// GetAppTraces returns the traces for an app
// TracingName is the name to be used to query the tracing backend (Using the waypoint name in Ambient)
// App name is the name to filter the traces (When different)
// The returned traces are authorized per trace against the requested
// namespace (see filterTracesByNamespace), not by trusting the search name.
func (in *TracingService) GetAppTraces(ctx context.Context, ns, tracingName, app string, query models.TracingQuery) (*model.TracingResponse, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	serviceName := in.buildTracingServiceName(ctx, query.Cluster, ns, tracingName)
	r, err := client.GetAppTraces(ctx, ns, serviceName, query)
	if tracingName != app && r != nil {
		// Filter by app
		filter := operationSpanFilter(ctx, ns, app)
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			for _, span := range trace.Spans {
				if filter(&span) {
					traces = append(traces, trace)
					break
				}
			}
		}
		r.Data = traces
	}
	if err != nil {
		return nil, err
	}
	if r != nil {
		r.Data = filterTracesByNamespace(r.Data, query.Cluster, ns)
	}

	return r, nil
}

// GetServiceTraces returns traces involving the requested service.  Note that because the tracing API pulls traces by "App", only a
// subset of the traces may actually involve the requested service.  Callers may need to upwardly adjust TracingQuery.Limit to get back
// the number of desired traces.  It depends on the number of services backing the app. For example, if there are 2 services for the
// app, if evenly distributed, a query limit of 20 may return only 10 traces.  The ratio is typically not as bad as it is with
// GetWorkloadTraces.
func (in *TracingService) GetServiceTraces(ctx context.Context, ns, service string, query models.TracingQuery) (*model.TracingResponse, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceTraces",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, query.Cluster),
		observability.Attribute("namespace", ns),
		observability.Attribute("service", service),
	)
	defer end()

	zl := log.FromContext(ctx)

	app, err := in.svc.GetServiceTracingName(ctx, query.Cluster, ns, service)
	if err != nil {
		return nil, err
	}
	if app.Lookup == service {
		// No post-filtering
		zl.Trace().Msgf("GetServiceTraces [%s] for service [%s]", app.Lookup, service)
		return in.GetAppTraces(ctx, ns, service, app.Lookup, query)
	}

	zl.Trace().Msgf("GetServiceTraces [%s] for service [%s]", app.Lookup, service)
	r, err := in.GetAppTraces(ctx, ns, app.Lookup, service, query)
	if r != nil && err == nil {
		// Filter out app traces based on operation name.
		// For envoy traces, operation name is like "service-name.namespace.svc.cluster.local:8000/*"
		filter := operationSpanFilter(ctx, ns, service)
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			for _, span := range trace.Spans {
				if filter(&span) {
					traces = append(traces, trace)
					break
				}
			}
		}
		r.Data = traces
	}
	return r, err
}

// GetWorkloadTraces returns traces involving the requested workload.  Note that because the tracing API pulls traces by "App", only
// a subset of the traces may actually involve the requested workload.  Callers may need to upwardly adjust TracingQuery.Limit to get back
// the number of desired traces.  It depends on the number of workloads backing the app. For example, if there are 5 workloads for the
// app, if evenly distributed, a query limit of 25 may return only 5 traces.
func (in *TracingService) GetWorkloadTraces(ctx context.Context, ns, workload string, query models.TracingQuery) (*model.TracingResponse, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetWorkloadTraces",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, query.Cluster),
		observability.Attribute("namespace", ns),
		observability.Attribute("workload", workload),
	)
	defer end()

	app, err := in.workload.GetWorkloadTracingName(ctx, query.Cluster, ns, workload)
	if err != nil {
		return nil, err
	}

	r, err := in.GetAppTraces(ctx, ns, app.Lookup, app.App, query)
	// Filter out app traces based on the node_id tag, that contains workload information.
	if r != nil && err == nil {
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			if matchesWorkload(ctx, &trace, ns, app) {
				traces = append(traces, trace)
			}
		}
		r.Data = traces
	}
	return r, err
}

// traceNamespaces returns the distinct namespaces a trace participates in,
// extracted from every source Kiali's span model can carry: the istio.*
// span tags and OTel resource attributes listed in model.NamespaceTagKeys,
// and the `node_id` tag. Cluster attribution is ignored here; see
// extractTraceNamespaceScope for the cluster-aware view used by
// CheckTraceAccess. Spans without namespace information do not contribute.
// Sorted for determinism.
func traceNamespaces(trace *model.TracingSingleTrace) []string {
	if trace == nil {
		return nil
	}
	scope := extractTraceNamespaceScope(&trace.Data)
	seen := make(map[string]struct{}, len(scope.unscoped))
	for ns := range scope.unscoped {
		seen[ns] = struct{}{}
	}
	for _, namespaces := range scope.byCluster {
		for ns := range namespaces {
			seen[ns] = struct{}{}
		}
	}
	if len(seen) == 0 {
		return nil
	}
	namespaces := make([]string, 0, len(seen))
	for ns := range seen {
		namespaces = append(namespaces, ns)
	}
	sort.Strings(namespaces)
	return namespaces
}

// traceNamespaceScope is the namespace-participation view of a trace used
// for authorization: the namespaces the telemetry attributes to a specific
// cluster, and the namespaces it does not attribute to any cluster.
type traceNamespaceScope struct {
	// byCluster maps a cluster to the namespaces the trace participates in
	// on that cluster (from spans carrying cluster attribution via
	// model.ClusterTagKeys).
	byCluster map[string]map[string]struct{}

	// unscoped holds the namespaces from spans without cluster attribution.
	unscoped map[string]struct{}
}

func (s *traceNamespaceScope) empty() bool {
	return len(s.byCluster) == 0 && len(s.unscoped) == 0
}

// extractTraceNamespaceScope walks every span of the trace and pairs each
// span's namespace information (the model.NamespaceTagKeys tags and the
// `node_id` tag) with the span's cluster attribution (the model.ClusterTagKeys
// tags) when present. A span without cluster attribution contributes its
// namespaces to unscoped. Spans without namespace information do not
// contribute. It takes the raw Jaeger-model trace so both the single-trace
// (details) and the list authorizations can share it.
func extractTraceNamespaceScope(trace *jaegerModels.Trace) *traceNamespaceScope {
	scope := &traceNamespaceScope{
		byCluster: map[string]map[string]struct{}{},
		unscoped:  map[string]struct{}{},
	}
	if trace == nil {
		return scope
	}
	for _, span := range trace.Spans {
		processTags := spanProcessTags(trace, span)
		cluster := spanCluster(span, processTags)
		add := func(namespace string) {
			// Tempo search answers render a selected-but-absent attribute as
			// the literal string "nil" (observed on Tempo 2.10); that is a
			// missing-value marker, not a namespace, so it must not
			// contribute a phantom "nil" namespace to the scope.
			if namespace == "" || namespace == "nil" {
				return
			}
			if cluster == "" {
				scope.unscoped[namespace] = struct{}{}
				return
			}
			set, ok := scope.byCluster[cluster]
			if !ok {
				set = map[string]struct{}{}
				scope.byCluster[cluster] = set
			}
			set[namespace] = struct{}{}
		}
		for _, tag := range span.Tags {
			if v, ok := tag.Value.(string); ok {
				if tag.Key == "node_id" {
					add(namespaceFromNodeID(v))
					continue
				}
				if slices.Contains(model.NamespaceTagKeys, tag.Key) {
					add(v)
				}
			}
		}
		for _, tag := range processTags {
			if v, ok := tag.Value.(string); ok && slices.Contains(model.NamespaceTagKeys, tag.Key) {
				add(v)
			}
		}
	}
	return scope
}

// spanProcessTags returns the span's process tags: the inline Process when
// set (the Tempo converter populates it), otherwise the trace-level
// Processes map entry for the span's ProcessID (Jaeger JSON responses keep
// process information there and leave the span's Process nil). Without the
// map lookup, process-level OTel attributes (k8s.namespace.name,
// k8s.cluster.name) would be invisible on Jaeger backends.
func spanProcessTags(trace *jaegerModels.Trace, span jaegerModels.Span) []jaegerModels.KeyValue {
	if span.Process != nil {
		return span.Process.Tags
	}
	if process, ok := trace.Processes[span.ProcessID]; ok {
		return process.Tags
	}
	return nil
}

// spanCluster returns the cluster the span's telemetry is attributed to,
// from the span tags or the process tags (OTel resource attributes surfaced
// by the converters; see spanProcessTags). Empty when the span carries no
// cluster attribution. The literal "nil" counts as absent: Tempo search
// answers render selected-but-absent attributes that way (observed on
// Tempo 2.10), and it is a missing-value marker, not a cluster name.
func spanCluster(span jaegerModels.Span, processTags []jaegerModels.KeyValue) string {
	clusterFromTags := func(tags []jaegerModels.KeyValue) string {
		for _, tag := range tags {
			if slices.Contains(model.ClusterTagKeys, tag.Key) {
				if v, ok := tag.Value.(string); ok && v != "" && v != "nil" {
					return v
				}
			}
		}
		return ""
	}
	if cluster := clusterFromTags(span.Tags); cluster != "" {
		return cluster
	}
	return clusterFromTags(processTags)
}

// namespaceFromNodeID extracts the namespace from a sidecar/router/waypoint
// node_id tag: <type>~<ip>~<pod>.<ns>~<ns>.svc.cluster.local. The namespace
// is the part of the 4th ~ field before the first dot, so custom cluster
// domains (suffixes of that field) are handled.
func namespaceFromNodeID(nodeID string) string {
	parts := strings.Split(nodeID, "~")
	if len(parts) < 4 {
		return ""
	}
	ns, _, found := strings.Cut(parts[3], ".")
	if !found {
		return ""
	}
	return ns
}

// CheckTraceAccess authorizes a fetched trace: the user must be able to
// access at least one namespace the trace participates in. Where the
// telemetry attributes a namespace to a cluster (the model.ClusterTagKeys
// tags: the `istio.cluster_id` span tag, the `k8s.cluster.name` OTel
// resource attribute), the namespace must be accessible to the user in that
// specific cluster — a namespace the user can only see in another cluster
// does not authorize a trace attributed elsewhere. Namespaces without
// cluster attribution are authorized by name against any cluster: the
// telemetry cannot be scoped more precisely, and failing closed on them
// would deny traces whose sidecar spans carry no cluster tag. It is the
// shared authorization for the trace-details endpoint and the
// get_trace_details MCP tool, so the two cannot drift. A trace with no
// recognizable namespace information is denied (fail closed) — this hides
// traces from non-mesh apps whose telemetry carries no namespace
// information.
//
// Cluster attribution is matched against Kiali's cluster names, which by
// default equal the Istio cluster IDs (Kiali derives its home cluster name
// from istiod's CLUSTER_ID, and the Tempo TraceQL queries filter on
// .istio.cluster_id with the same names). An explicitly configured
// kubernetes_config.cluster_name or cluster_name_overrides that diverges
// from the Istio cluster IDs denies every cluster-attributed trace, for
// every user; the denial path logs a debug message when that mismatch is
// the apparent cause.
func (in *TracingService) CheckTraceAccess(ctx context.Context, trace *model.TracingSingleTrace) error {
	scope := extractTraceNamespaceScope(&trace.Data)
	if scope.empty() {
		return NewAccessibleNamespaceError("trace does not reference any accessible namespace")
	}
	accessible, err := in.namespace.GetNamespaces(ctx)
	if err != nil {
		return err
	}
	// Group the accessible set by cluster. The union is assembled from the
	// per-cluster per-token cache entries, so this adds no computation over
	// what the name-only check already fetched.
	accessibleByCluster := make(map[string]map[string]struct{})
	for _, ns := range accessible {
		set, ok := accessibleByCluster[ns.Cluster]
		if !ok {
			set = make(map[string]struct{})
			accessibleByCluster[ns.Cluster] = set
		}
		set[ns.Name] = struct{}{}
	}
	// Cluster-attributed namespaces require access to that namespace in
	// that cluster.
	for cluster, namespaces := range scope.byCluster {
		if set, ok := accessibleByCluster[cluster]; ok {
			for ns := range namespaces {
				if _, ok := set[ns]; ok {
					return nil
				}
			}
		}
	}
	// Cluster-less namespaces fall back to name matching in any cluster.
	for ns := range scope.unscoped {
		for _, set := range accessibleByCluster {
			if _, ok := set[ns]; ok {
				return nil
			}
		}
	}

	// The request is denied. When none of the clusters the trace is
	// attributed to matches any of the user's cluster names, the likely
	// cause is telemetry cluster IDs diverging from Kiali's cluster names
	// (an explicit kubernetes_config.cluster_name or cluster_name_overrides);
	// surface that in the debug log, without changing the result.
	unknownClusters := make([]string, 0, len(scope.byCluster))
	for cluster := range scope.byCluster {
		if _, known := accessibleByCluster[cluster]; !known {
			unknownClusters = append(unknownClusters, cluster)
		}
	}
	if len(scope.byCluster) > 0 && len(unknownClusters) == len(scope.byCluster) {
		knownClusters := make([]string, 0, len(accessibleByCluster))
		for cluster := range accessibleByCluster {
			knownClusters = append(knownClusters, cluster)
		}
		sort.Strings(knownClusters)
		sort.Strings(unknownClusters)
		log.FromContext(ctx).Debug().Msgf(
			"Trace denied: its cluster attribution [%s] matches none of Kiali's cluster names [%s]; the telemetry's istio.cluster_id values may not match the configured cluster names.",
			strings.Join(unknownClusters, ", "), strings.Join(knownClusters, ", "))
	}
	return NewAccessibleNamespaceError("trace does not reference any accessible namespace")
}

// traceInNamespace reports whether at least one span of the trace is
// attributed to the given namespace on the given cluster. It uses the same
// namespace/cluster extraction and pairing as CheckTraceAccess: a span
// carrying cluster attribution (the model.ClusterTagKeys tags) counts only
// for that cluster, spans without cluster attribution count for any cluster.
// An empty cluster matches any cluster attribution by name. A trace whose
// spans carry no namespace information does not match (fail closed, like
// CheckTraceAccess).
func traceInNamespace(trace *jaegerModels.Trace, cluster, namespace string) bool {
	scope := extractTraceNamespaceScope(trace)
	if _, ok := scope.unscoped[namespace]; ok {
		return true
	}
	if cluster == "" {
		for _, namespaces := range scope.byCluster {
			if _, ok := namespaces[namespace]; ok {
				return true
			}
		}
		return false
	}
	namespaces, ok := scope.byCluster[cluster]
	if !ok {
		return false
	}
	_, ok = namespaces[namespace]
	return ok
}

// filterTracesByNamespace keeps only the traces with at least one span
// attributed to the namespace (see traceInNamespace). It authorizes the
// namespace-scoped trace lists and span views: the search name sent to the
// tracing backend is derived from caller-supplied names, and a name that
// contains the identity domain (or a backend with the namespace selector
// disabled, whose telemetry service names are not namespace-qualified at
// all) can target a service in any namespace, so the returned traces are
// authorized per trace instead of trusting the search name. The requested
// namespace — not the user's whole accessible set — is the anchor: the list
// answers "what is in this view".
func filterTracesByNamespace(traces []jaegerModels.Trace, cluster, namespace string) []jaegerModels.Trace {
	if len(traces) == 0 {
		return traces
	}
	kept := make([]jaegerModels.Trace, 0, len(traces))
	for i := range traces {
		if traceInNamespace(&traces[i], cluster, namespace) {
			kept = append(kept, traces[i])
		}
	}
	return kept
}

func (in *TracingService) GetTraceDetail(ctx context.Context, traceID string) (trace *model.TracingSingleTrace, err error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetTraceDetail(ctx, traceID)
}

// GetErrorTraces returns the number of error traces for the app in the
// namespace. The count is authorized per trace against the requested
// namespace (see filterTracesByNamespace): the search name is derived from
// the caller-supplied app name, which can target a service in any namespace
// (see GetAppTraces), so the backend's raw count cannot be trusted.
func (in *TracingService) GetErrorTraces(ctx context.Context, cluster, ns, app string, duration time.Duration) (errorTraces int, err error) {
	// The query itself is timed by GetAppTraces (the "AppTraces" label);
	// this timer keeps the error-trace count distinguishable from ordinary
	// trace searches in the TracingProcessingTime metric.
	promtimer := internalmetrics.GetTracingProcessingTimePrometheusTimer("ErrorTraces")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, in.conf, promtimer, "TracingProcessingTime", nil, "ErrorTraces")

	client, err := in.client()
	if err != nil {
		return 0, err
	}
	serviceName := in.buildTracingServiceName(ctx, cluster, ns, app)
	now := time.Now()
	query := models.TracingQuery{
		Cluster: cluster,
		Start:   now.Add(-duration),
		End:     now,
		Tags:    map[string]string{"error": "true"},
	}
	maps.Copy(query.Tags, in.conf.ExternalServices.Tracing.QueryScope)
	traces, err := client.GetAppTraces(ctx, ns, serviceName, query)
	if err != nil {
		return 0, err
	}
	return len(filterTracesByNamespace(traces.Data, cluster, ns)), nil
}

func (in *TracingService) GetStatus(ctx context.Context) (accessible bool, err error) {
	client, err := in.client()
	if err != nil {
		return false, err
	}
	return client.GetServiceStatus(ctx)
}

func matchesWorkload(ctx context.Context, trace *jaegerModels.Trace, namespace string, tracingName models.TracingName) bool {
	for _, span := range trace.Spans {
		if process, ok := trace.Processes[span.ProcessID]; ok {
			span.Process = &process
		}
		if spanMatchesWorkload(ctx, &span, namespace, tracingName) {
			return true
		}
	}
	return false
}

// spanMatchesWorkload matches a span based on a node id or the hostname
// For Ambient, as the trace is reported by the Waypoint proxy, a match based on the app is done
func spanMatchesWorkload(ctx context.Context, span *jaegerModels.Span, namespace string, tracingName models.TracingName) bool {
	zl := log.FromContext(ctx)

	// If the workload has a waypoint, the span won't match, but the operation name can
	// When the workload has a waypoint, the operation name is filtered by the service
	if tracingName.WaypointName != "" {
		if spanHasAmbientWorkloadTags(span) {
			matched := spanMatchesAmbientWorkload(span, tracingName.Workload, namespace)
			zl.Trace().Msgf("spanMatchesWorkload ambient tags match=[%t] workload=[%s] tags=[%+v]", matched, tracingName.Workload, span.Tags)
			return matched
		}
		// Fallback for older Istio traces that don't include ambient workload tags.
		op := fmt.Sprintf("%s.%s", tracingName.App, namespace)
		zl.Trace().Msgf("spanMatchesWorkload fallback operationName=[%s] prefix=[%s] (waypoint legacy)", span.OperationName, op)
		return strings.HasPrefix(span.OperationName, op)
	}
	// For envoy traces, with a workload named "ai-locals", node_id is like:
	// sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
	for _, tag := range span.Tags {
		if tag.Key == "node_id" {
			if v, ok := tag.Value.(string); ok {
				parts := strings.Split(v, "~")
				if len(parts) >= 3 {
					zl.Trace().Msgf("spanMatchesWorkload [%s] has prefix [%s] and suffix [%s]", parts[2], tracingName.Workload, namespace)
				}
				if len(parts) >= 3 && strings.HasPrefix(parts[2], tracingName.Workload) && strings.HasSuffix(parts[2], namespace) {
					return true
				}
			}
		}
		// For Tempo Traces
		if tag.Key == "hostname" {
			if v, ok := tag.Value.(string); ok {
				zl.Trace().Msgf("spanMatchesWorkload [%s] has prefix [%s] (a)", v, tracingName.Workload)
				if strings.HasPrefix(v, tracingName.Workload) {
					return true
				}
			}
		}
	}
	// Tag not found => try with 'hostname' in process' tags
	if span.Process != nil {
		for _, tag := range span.Process.Tags {
			if tag.Key == "hostname" {
				if v, ok := tag.Value.(string); ok {
					zl.Trace().Msgf("spanMatchesWorkload [%s] has prefix [%s] (b)", v, tracingName.Workload)
					if strings.HasPrefix(v, tracingName.Workload) {
						return true
					}
				}
			}
		}
	}
	return false
}

func tracesToSpans(ctx context.Context, app models.TracingName, r *model.TracingResponse, filter SpanFilter, conf *config.Config) []model.TracingSpan {
	spans := []model.TracingSpan{}
	for _, trace := range r.Data {
		if app.WaypointName != "" {
			for _, span := range trace.Spans {
				if filter == nil || filter(&span) {
					spans = append(spans, model.TracingSpan{
						Span:      span,
						TraceSize: len(trace.Spans),
					})
				}
			}
			continue
		}
		// Diferent for Tempo & Jaeger
		// For Tempo the proccess matched with the service name of the trace batch
		// So t is already filtered in the query
		if conf.ExternalServices.Tracing.Provider == config.TempoProvider {
			// Second, find spans for these processes
			for _, span := range trace.Spans {
				if span.Process.ServiceName == r.TracingServiceName {
					if filter == nil || filter(&span) {
						spans = append(spans, model.TracingSpan{
							Span:      span,
							TraceSize: len(trace.Spans),
						})
					}
				}
			}
		} else {
			// First, get the desired processes for our service
			processes := make(map[jaegerModels.ProcessID]jaegerModels.Process)
			for pId, process := range trace.Processes {
				if process.ServiceName == app.Lookup || process.ServiceName == r.TracingServiceName {
					processes[pId] = process
				}
			}
			// Second, find spans for these processes
			for _, span := range trace.Spans {
				if p, ok := processes[span.ProcessID]; ok {
					span.Process = &p
					if filter == nil || filter(&span) {
						spans = append(spans, model.TracingSpan{
							Span:      span,
							TraceSize: len(trace.Spans),
						})
					}
				}
			}
		}
	}
	log.FromContext(ctx).Trace().Msgf("Found [%d] spans in the [%d] traces for app [%s]", len(spans), len(r.Data), app)
	return spans
}

func (in *TracingService) TracingDiagnose(ctx context.Context, token string) (trace *model.TracingDiagnose, err error) {
	return tracing.DiagnoseTracingConfig(ctx, in.conf, token)
}

func (in *TracingService) ValidateConfiguration(ctx context.Context, conf *config.Config, tracingConfig *config.TracingConfig, token string) *model.ConfigurationValidation {
	validation := model.ConfigurationValidation{}

	// Merge config - restore obfuscated values from the actual config
	// Note: CAFile is deprecated and is not processed
	if tracingConfig.Auth.CertFile == "xxx" {
		tracingConfig.Auth.CertFile = conf.ExternalServices.Tracing.Auth.CertFile
	}
	if tracingConfig.Auth.KeyFile == "xxx" {
		tracingConfig.Auth.KeyFile = conf.ExternalServices.Tracing.Auth.KeyFile
	}
	if tracingConfig.Auth.Password == "xxx" {
		tracingConfig.Auth.Password = conf.ExternalServices.Tracing.Auth.Password
	}
	if tracingConfig.Auth.Token == "xxx" {
		tracingConfig.Auth.Token = conf.ExternalServices.Tracing.Auth.Token
	}
	if tracingConfig.Auth.Username == "xxx" {
		tracingConfig.Auth.Username = conf.ExternalServices.Tracing.Auth.Username
	}

	newConfig := *conf
	newConfig.ExternalServices.Tracing = *tracingConfig

	// Try to create client
	client, err := tracing.NewClient(ctx, &newConfig, token, false)
	if client == nil {
		msg := "ValidateConfiguration: Error creating tracing client"
		if err != nil {
			msg = fmt.Sprintf("%s: [%v]. ", msg, err)
		}
		log.FromContext(ctx).Trace().Msg(msg)
		validation.Error = msg
		return &validation
	}

	// Validate endpoint
	status, err := client.GetServiceStatus(ctx)
	log.FromContext(ctx).Trace().Msgf("GetServiceStatus %v", status)

	if err != nil {
		validation.Error = fmt.Sprintf("Error getting service status: [%v]. ", err)
		return &validation
	}

	// Test any service
	_, err = client.GetServices(ctx)
	if err != nil {
		_, err = client.GetServiceStatus(ctx)
		if err != nil {
			validation.Error = fmt.Sprintf("Error getting services list: [%v]. ", err)
			return &validation
		}
	}

	validation.Message = "Success getting service status"
	return &validation
}
