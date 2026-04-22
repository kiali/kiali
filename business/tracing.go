package business

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

type (
	SpanFilter = func(span *jaegerModels.Span) bool
)

type TracingService struct {
	app      *AppService
	conf     *config.Config
	svc      *SvcService
	tracing  tracing.ClientInterface
	workload *WorkloadService
}

func NewTracingService(conf *config.Config, tracing tracing.ClientInterface, svcService *SvcService, workloadService *WorkloadService, appService *AppService) TracingService {
	return TracingService{
		app:      appService,
		conf:     conf,
		svc:      svcService,
		tracing:  tracing,
		workload: workloadService,
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
	tracingName := in.app.GetAppTracingName(ctx, cluster, ns, app)
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

func (in *TracingService) GetTraceDetail(ctx context.Context, traceID string) (trace *model.TracingSingleTrace, err error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetTraceDetail(ctx, traceID)
}

func (in *TracingService) GetErrorTraces(ctx context.Context, cluster, ns, app string, duration time.Duration) (errorTraces int, err error) {
	client, err := in.client()
	if err != nil {
		return 0, err
	}
	serviceName := in.buildTracingServiceName(ctx, cluster, ns, app)
	return client.GetErrorTraces(ctx, ns, serviceName, duration)
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
