package business

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nitishm/engarde/pkg/parser"
	osapps_v1 "github.com/openshift/api/apps/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util/sliceutil"
)

func NewWorkloadService(
	userClients map[string]kubernetes.ClientInterface,
	kialiSAclients map[string]kubernetes.ClientInterface,
	prom prometheus.ClientInterface,
	cache cache.KialiCache,
	layer *Layer,
	config *config.Config,
	grafana *grafana.Service,
) *WorkloadService {
	excludedWorkloads := make(map[string]bool)
	for _, w := range config.KubernetesConfig.ExcludeWorkloads {
		excludedWorkloads[w] = true
	}

	return &WorkloadService{
		businessLayer:     layer,
		cache:             cache,
		config:            config,
		excludedWorkloads: excludedWorkloads,
		prom:              prom,
		userClients:       userClients,
		kialiSAClients:    kialiSAclients,
	}
}

// WorkloadService deals with fetching istio/kubernetes workloads related content and convert to kiali model
type WorkloadService struct {
	// Careful not to call the workload service from here as that would be an infinite loop.
	businessLayer *Layer
	// The global kiali cache. This should be passed into the workload service rather than created inside of it.
	cache cache.KialiCache
	// The global kiali config.
	config            *config.Config
	excludedWorkloads map[string]bool
	grafana           *grafana.Service
	prom              prometheus.ClientInterface
	userClients       map[string]kubernetes.ClientInterface
	kialiSAClients    map[string]kubernetes.ClientInterface
}

type WorkloadCriteria struct {
	Cluster               string
	Namespace             string
	WorkloadName          string
	WorkloadGVK           schema.GroupVersionKind
	IncludeIstioResources bool
	IncludeServices       bool
	IncludeHealth         bool
	IncludeWaypoints      bool
	RateInterval          string
	QueryTime             time.Time
}

// PodLog reports log entries
type PodLog struct {
	Entries        []LogEntry `json:"entries,omitempty"`
	LinesTruncated bool       `json:"linesTruncated,omitempty"`
}

// AccessLogEntry provides parsed info from a single proxy access log entry
type AccessLogEntry struct {
	Timestamp     string `json:"timestamp,omitempty"`
	TimestampUnix int64  `json:"timestampUnix,omitempty"`
}

// LogEntry holds a single log entry
type LogEntry struct {
	Message       string            `json:"message,omitempty"`
	Severity      string            `json:"severity,omitempty"`
	OriginalTime  time.Time         `json:"-"`
	Timestamp     string            `json:"timestamp,omitempty"`
	TimestampUnix int64             `json:"timestampUnix,omitempty"`
	AccessLog     *parser.AccessLog `json:"accessLog,omitempty"`
}

type filterOpts struct {
	app     regexp.Regexp
	destWk  regexp.Regexp
	destNs  regexp.Regexp
	srcWk   regexp.Regexp
	srcNs   regexp.Regexp
	destSvc regexp.Regexp
}

// LogOptions holds query parameter values
type LogOptions struct {
	Duration *time.Duration
	LogType  models.LogType
	MaxLines *int
	core_v1.PodLogOptions
	filter filterOpts
}

// Matches an ISO8601 full date
var severityRegexp = regexp.MustCompile(`(?i)ERROR|WARN|DEBUG|TRACE`)

func (in *WorkloadService) isWorkloadIncluded(workload string) bool {
	if in.excludedWorkloads == nil {
		return true
	}
	return !in.excludedWorkloads[workload]
}

// isWorkloadValid returns true if it is a known workload type and it is not configured as excluded
func (in *WorkloadService) isWorkloadValid(workloadType string) bool {
	_, knownWorkloadType := controllerOrder[workloadType]
	return knownWorkloadType && in.isWorkloadIncluded(workloadType)
}

// @TODO do validations per cluster
func (in *WorkloadService) getWorkloadValidations(authpolicies []*security_v1.AuthorizationPolicy, workloadsPerNamespace map[string]models.WorkloadList) models.IstioValidations {
	validations := checkers.WorkloadChecker{
		AuthorizationPolicies: authpolicies,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}.Check()

	return validations
}

// GetAllWorkloads fetches all workloads across the cluster's namespaces.
func (in *WorkloadService) GetAllWorkloads(ctx context.Context, cluster string, labelSelector string) (models.Workloads, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetAllWorkloads",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	namespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return nil, err
	}

	var workloads models.Workloads
	for _, namespace := range namespaces {
		w, err := in.fetchWorkloadsFromCluster(ctx, cluster, namespace.Name, labelSelector)
		if err != nil {
			return nil, err
		}

		workloads = append(workloads, w...)
	}

	return workloads, nil
}

// GetAllGateways fetches all gateway workloads across every namespace in the cluster.
func (in *WorkloadService) GetAllGateways(ctx context.Context, cluster string, labelSelector string) (models.Workloads, error) {
	workloads, err := in.GetAllWorkloads(ctx, cluster, labelSelector)
	if err != nil {
		return nil, err
	}

	return sliceutil.Filter(workloads, func(w *models.Workload) bool {
		return w.IsGateway()
	}), nil
}

// GetWorkloadList is the API handler to fetch the list of workloads in a given namespace.
func (in *WorkloadService) GetWorkloadList(ctx context.Context, criteria WorkloadCriteria) (models.WorkloadList, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetWorkloadList",
		observability.Attribute("package", "business"),
		observability.Attribute("includeHealth", criteria.IncludeHealth),
		observability.Attribute("includeIstioResources", criteria.IncludeIstioResources),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	namespace := criteria.Namespace
	cluster := criteria.Cluster

	workloadList := &models.WorkloadList{
		Namespace:   namespace,
		Workloads:   []models.WorkloadListItem{},
		Validations: models.IstioValidations{},
	}

	if _, ok := in.userClients[cluster]; !ok {
		return *workloadList, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return *workloadList, err
	}

	var ws models.Workloads
	// var authpolicies []*security_v1.AuthorizationPolicy
	var err error

	nFetches := 1
	if criteria.IncludeIstioResources {
		nFetches = 2
	}

	wg := sync.WaitGroup{}
	wg.Add(nFetches)
	errChan := make(chan error, nFetches)

	go func(ctx context.Context) {
		defer wg.Done()
		var err2 error
		ws, err2 = in.fetchWorkloadsFromCluster(ctx, cluster, namespace, "")
		if err2 != nil {
			log.Errorf("Error fetching Workloads per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}(ctx)

	var istioConfigMap models.IstioConfigMap

	if criteria.IncludeIstioResources {
		istioConfigCriteria := IstioConfigCriteria{
			IncludeAuthorizationPolicies:  true,
			IncludeEnvoyFilters:           true,
			IncludeGateways:               true,
			IncludeK8sGateways:            true,
			IncludePeerAuthentications:    true,
			IncludeRequestAuthentications: true,
			IncludeSidecars:               true,
			IncludeWorkloadGroups:         true,
		}

		go func(ctx context.Context) {
			defer wg.Done()
			var err2 error
			istioConfigMap, err2 = in.businessLayer.IstioConfig.GetIstioConfigMap(ctx, namespace, istioConfigCriteria)
			if err2 != nil {
				log.Errorf("Error fetching Istio Config per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}(ctx)
	}

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return *workloadList, err
	}

	for _, w := range ws {
		wItem := &models.WorkloadListItem{Health: *models.EmptyWorkloadHealth()}
		wItem.ParseWorkload(w)
		if istioConfigList, ok := istioConfigMap[cluster]; ok && criteria.IncludeIstioResources {
			wItem.IstioReferences = FilterUniqueIstioReferences(FilterWorkloadReferences(in.config, wItem.Labels, istioConfigList, cluster))
		}
		if criteria.IncludeHealth {
			wItem.Health, err = in.businessLayer.Health.GetWorkloadHealth(ctx, namespace, cluster, wItem.Name, criteria.RateInterval, criteria.QueryTime, w)
			if err != nil {
				log.Errorf("Error fetching Health in namespace %s for workload %s: %s", namespace, wItem.Name, err)
			}
		}
		wItem.Cluster = cluster
		wItem.Namespace = namespace
		workloadList.Workloads = append(workloadList.Workloads, *wItem)
	}

	for _, istioConfigList := range istioConfigMap {
		// @TODO multi cluster validations
		authpolicies := istioConfigList.AuthorizationPolicies
		allWorkloads := map[string]models.WorkloadList{}
		allWorkloads[namespace] = *workloadList
		validations := in.getWorkloadValidations(authpolicies, allWorkloads)
		validations.StripIgnoredChecks()
		workloadList.Validations = workloadList.Validations.MergeValidations(validations)
	}

	return *workloadList, nil
}

func FilterWorkloadReferences(config *config.Config, wLabels map[string]string, istioConfigList models.IstioConfigList, cluster string) []*models.IstioValidationKey {
	wkdReferences := make([]*models.IstioValidationKey, 0)
	wSelector := labels.Set(wLabels).AsSelector().String()
	gwFiltered := kubernetes.FilterGatewaysBySelector(wSelector, istioConfigList.Gateways)
	for _, g := range gwFiltered {
		ref := models.BuildKey(kubernetes.Gateways, g.Name, g.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	k8sGwFiltered := kubernetes.FilterK8sGatewaysByLabel(istioConfigList.K8sGateways, wLabels[config.IstioLabels.AmbientWaypointGatewayLabel])
	for _, g := range k8sGwFiltered {
		ref := models.BuildKey(kubernetes.K8sGateways, g.Name, g.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	apFiltered := kubernetes.FilterAuthorizationPoliciesBySelector(wSelector, istioConfigList.AuthorizationPolicies)
	for _, a := range apFiltered {
		ref := models.BuildKey(kubernetes.AuthorizationPolicies, a.Name, a.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	paFiltered := kubernetes.FilterPeerAuthenticationsBySelector(wSelector, istioConfigList.PeerAuthentications)
	for _, p := range paFiltered {
		ref := models.BuildKey(kubernetes.PeerAuthentications, p.Name, p.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	scFiltered := kubernetes.FilterSidecarsBySelector(wSelector, istioConfigList.Sidecars)
	for _, s := range scFiltered {
		ref := models.BuildKey(kubernetes.Sidecars, s.Name, s.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	raFiltered := kubernetes.FilterRequestAuthenticationsBySelector(wSelector, istioConfigList.RequestAuthentications)
	for _, ra := range raFiltered {
		ref := models.BuildKey(kubernetes.RequestAuthentications, ra.Name, ra.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	efFiltered := kubernetes.FilterEnvoyFiltersBySelector(wSelector, istioConfigList.EnvoyFilters)
	for _, ef := range efFiltered {
		ref := models.BuildKey(kubernetes.EnvoyFilters, ef.Name, ef.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	wgFiltered := kubernetes.FilterWorkloadGroupsBySelector(wSelector, istioConfigList.WorkloadGroups)
	for _, wg := range wgFiltered {
		ref := models.BuildKey(kubernetes.WorkloadGroups, wg.Name, wg.Namespace, cluster)
		exist := false
		for _, r := range wkdReferences {
			exist = exist || *r == ref
		}
		if !exist {
			wkdReferences = append(wkdReferences, &ref)
		}
	}
	return wkdReferences
}

func FilterUniqueIstioReferences(refs []*models.IstioValidationKey) []*models.IstioValidationKey {
	refMap := make(map[models.IstioValidationKey]struct{})
	for _, ref := range refs {
		if _, exist := refMap[*ref]; !exist {
			refMap[*ref] = struct{}{}
		}
	}
	filtered := make([]*models.IstioValidationKey, 0)
	for k := range refMap {
		filtered = append(filtered, &models.IstioValidationKey{
			ObjectGVK: k.ObjectGVK,
			Name:      k.Name,
			Namespace: k.Namespace,
		})
	}
	return filtered
}

// GetWorkload is the API handler to fetch details of a specific workload.
// If includeServices is set true, the Workload will fetch all services related
func (in *WorkloadService) GetWorkload(ctx context.Context, criteria WorkloadCriteria) (*models.Workload, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetWorkload",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("workloadName", criteria.WorkloadName),
		observability.Attribute("workloadType", criteria.WorkloadGVK.String()),
		observability.Attribute("includeServices", criteria.IncludeServices),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	ns, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, criteria.Namespace, criteria.Cluster)
	if err != nil {
		return nil, err
	}

	criteria.IncludeWaypoints = true
	workload, err2 := in.fetchWorkload(ctx, criteria)
	if err2 != nil {
		return nil, err2
	}

	var runtimes []models.Runtime
	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		conf := in.config
		appLabelName, _ := conf.GetAppLabelName(workload.Labels)
		verLabelName, _ := conf.GetVersionLabelName(workload.Labels)
		app := workload.Labels[appLabelName]
		version := workload.Labels[verLabelName]
		runtimes = NewDashboardsService(in.config, in.grafana, ns, workload).GetCustomDashboardRefs(criteria.Namespace, app, version, workload.Pods)
	}()

	// WorkloadGroup.Labels can be empty
	if criteria.IncludeServices && len(workload.Labels) > 0 {
		var services *models.ServiceList
		var err error

		serviceCriteria := ServiceCriteria{
			Cluster:                criteria.Cluster,
			Namespace:              criteria.Namespace,
			ServiceSelector:        labels.Set(workload.Labels).String(),
			IncludeHealth:          false,
			IncludeOnlyDefinitions: true,
		}
		services, err = in.businessLayer.Svc.GetServiceList(ctx, serviceCriteria)
		if err != nil {
			return nil, err
		}
		workload.SetServices(services)
	}

	wg.Wait()
	workload.Runtimes = runtimes

	return workload, nil
}

func (in *WorkloadService) UpdateWorkload(ctx context.Context, cluster string, namespace string, workloadName string, workloadGVK schema.GroupVersionKind, includeServices bool, jsonPatch string, patchType string) (*models.Workload, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateWorkload",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("workloadName", workloadName),
		observability.Attribute("workloadKind", workloadGVK.Kind),
		observability.Attribute("workloadGroupVersion", workloadGVK.GroupVersion().String()),
		observability.Attribute("includeServices", includeServices),
		observability.Attribute("jsonPatch", jsonPatch),
		observability.Attribute("patchType", patchType),
	)
	defer end()

	// Identify controller and apply patch to workload
	err := in.updateWorkload(ctx, cluster, namespace, workloadName, workloadGVK, jsonPatch, patchType)
	if err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh.
	// Refresh once after all the updates have gone through since Update Workload will update
	// every single workload type of that matches name/namespace and we only want to refresh once.
	cache, err := in.cache.GetKubeCache(cluster)
	if err != nil {
		return nil, err
	}
	cache.Refresh(namespace)

	// After the update we fetch the whole workload
	return in.GetWorkload(ctx, WorkloadCriteria{Cluster: cluster, Namespace: namespace, WorkloadName: workloadName, WorkloadGVK: workloadGVK, IncludeServices: includeServices})
}

func (in *WorkloadService) GetPod(cluster, namespace, name string) (*models.Pod, error) {
	k8s, ok := in.userClients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	// This isn't using the cache for some reason but it never has.
	p, err := k8s.GetPod(namespace, name)
	if err != nil {
		return nil, err
	}

	pod := models.Pod{}
	pod.Parse(p)
	return &pod, nil
}

func (in *WorkloadService) BuildLogOptionsCriteria(container, duration string, logType models.LogType, sinceTime, maxLines string) (*LogOptions, error) {
	opts := &LogOptions{}
	opts.PodLogOptions = core_v1.PodLogOptions{Timestamps: true}

	if container != "" {
		opts.Container = container
	}

	if duration != "" {
		duration, err := time.ParseDuration(duration)
		if err != nil {
			return nil, fmt.Errorf("invalid duration [%s]: %v", duration, err)
		}

		opts.Duration = &duration
	}

	opts.LogType = logType

	if sinceTime != "" {
		numTime, err := strconv.ParseInt(sinceTime, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid sinceTime [%s]: %v", sinceTime, err)
		}

		opts.SinceTime = &meta_v1.Time{Time: time.Unix(numTime, 0)}
	}

	if maxLines != "" {
		if numLines, err := strconv.Atoi(maxLines); err == nil {
			if numLines > 0 {
				opts.MaxLines = &numLines
			}
		} else {
			return nil, fmt.Errorf("invalid maxLines [%s]: %v", maxLines, err)
		}
	}

	return opts, nil
}

func parseLogLine(line string, isProxy bool, engardeParser *parser.Parser) *LogEntry {
	entry := LogEntry{
		Message:       "",
		Timestamp:     "",
		TimestampUnix: 0,
		Severity:      "INFO",
	}

	splitted := strings.SplitN(line, " ", 2)
	if len(splitted) != 2 {
		log.Debugf("Skipping unexpected log line [%s]", line)
		return nil
	}

	// k8s promises RFC3339 or RFC3339Nano timestamp, ensure RFC3339
	// Split by blanks, to get the miliseconds for sorting, try RFC3339Nano
	entry.Timestamp = splitted[0]

	entry.Message = strings.TrimSpace(splitted[1])
	if entry.Message == "" {
		log.Debugf("Skipping empty log line [%s]", line)
		return nil
	}

	// If we are past the requested time window then stop processing
	parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp)
	entry.OriginalTime = parsedTimestamp
	if err != nil {
		log.Debugf("Failed to parse log timestamp (skipping) [%s], %s", entry.Timestamp, err.Error())
		return nil
	}

	severity := severityRegexp.FindString(line)
	if severity != "" {
		entry.Severity = strings.ToUpper(severity)
	}

	// If this is an istio access log, then parse it out. Prefer the access log time over the k8s time
	// as it is the actual time as opposed to the k8s store time.
	if isProxy {
		al, err := engardeParser.Parse(entry.Message)
		// engardeParser.Parse will not throw errors even if no fields
		// were parsed out. Checking here that some fields were actually
		// set before setting the AccessLog to an empty object. See issue #4346.
		if err != nil || isAccessLogEmpty(al) {
			if err != nil {
				log.Debugf("AccessLog parse failure: %s", err.Error())
			}
			// try to parse out the time manually
			tokens := strings.SplitN(entry.Message, " ", 2)
			timestampToken := strings.Trim(tokens[0], "[]")
			t, err := time.Parse(time.RFC3339, timestampToken)
			if err == nil {
				parsedTimestamp = t
			}
		} else {
			entry.AccessLog = al
			t, err := time.Parse(time.RFC3339, al.Timestamp)
			if err == nil {
				parsedTimestamp = t
			}

			// clear accessLog fields we don't need in the returned JSON
			entry.AccessLog.MixerStatus = ""
			entry.AccessLog.OriginalMessage = ""
			entry.AccessLog.ParseError = ""
		}
	}

	// override the timestamp with a simpler format
	timestamp := parseTimestamp(parsedTimestamp)
	entry.Timestamp = timestamp
	entry.TimestampUnix = parsedTimestamp.UnixMilli()

	return &entry
}

func parseZtunnelLine(line, name string) *LogEntry {
	entry := LogEntry{
		Message:       "",
		Timestamp:     "",
		TimestampUnix: 0,
		Severity:      "INFO",
	}

	splitted := strings.SplitN(line, " ", 2)
	if len(splitted) != 2 {
		log.Debugf("Skipping unexpected log line [%s]", line)
		return nil
	}

	msgSplit := strings.Split(line, "\t")

	if len(msgSplit) < 5 {
		log.Debugf("Error splitting log line [%s]", line)
		entry.Message = fmt.Sprintf("[%s] %s", name, line)
		return &entry
	}

	entry.Message = fmt.Sprintf("[%s] %s", name, msgSplit[4])
	if entry.Message == "" {
		log.Debugf("Skipping empty log line [%s]", line)
		entry.Message = fmt.Sprintf("[%s] %s", name, line)
		return &entry
	}

	// k8s promises RFC3339 or RFC3339Nano timestamp, ensure RFC3339
	// Split by blanks, to get the milliseconds for sorting, try RFC3339Nano
	ts := strings.Split(msgSplit[0], " ") // Sometime timestamp is duplicated
	entry.Timestamp = ts[0]

	// If we are past the requested time window then stop processing
	parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp)
	entry.OriginalTime = parsedTimestamp
	if err != nil {
		log.Debugf("Failed to parse log timestamp (skipping) [%s], %s", entry.Timestamp, err.Error())
		return nil
	}

	if splitted[1] != "" {
		entry.Severity = strings.ToUpper(splitted[1])
	}

	// override the timestamp with a simpler format
	timestamp := parseTimestamp(parsedTimestamp)
	entry.Timestamp = timestamp
	entry.TimestampUnix = parsedTimestamp.UnixMilli()

	// Process some access log data
	// More validations can be done. Data is in format direction=outbound
	// Also, more data could be added?
	al := parser.AccessLog{}
	al.Timestamp = timestamp
	if len(msgSplit) > 4 {
		accessLog := strings.Split(msgSplit[4], " ")
		for _, field := range accessLog {
			parsed := strings.SplitN(field, "=", 2)
			if len(parsed) == 2 {
				parsed[1] = strings.Replace(parsed[1], "\"", "", -1)
				switch parsed[0] {
				case "src.identity":
					al.UpstreamCluster = parsed[1]
				case "duration":
					al.Duration = parsed[1]
				case "bytes_recv":
					al.BytesReceived = parsed[1]
				case "bytes_sent":
					al.BytesSent = parsed[1]
				case "dst.service":
					al.RequestedServer = parsed[1]
				case "error":
					al.ParseError = parsed[1]
				case "dst.addr":
					al.UpstreamService = parsed[1]
				case "src.addr":
					al.DownstreamRemote = parsed[1]
				}
			}
		}
	}

	entry.AccessLog = &al

	return &entry
}

func parseTimestamp(parsedTimestamp time.Time) string {
	precision := strings.Split(parsedTimestamp.String(), ".")
	var milliseconds string
	if len(precision) > 1 {
		ms := precision[1]
		milliseconds = ms[:3]
		splittedms := strings.Fields(milliseconds) // This is needed to avoid invalid dates in ms like 200
		milliseconds = splittedms[0]
	} else {
		milliseconds = "000"
	}

	timestamp := fmt.Sprintf("%d-%02d-%02d %02d:%02d:%02d.%s",
		parsedTimestamp.Year(), parsedTimestamp.Month(), parsedTimestamp.Day(),
		parsedTimestamp.Hour(), parsedTimestamp.Minute(), parsedTimestamp.Second(), milliseconds)
	return timestamp
}

func isAccessLogEmpty(al *parser.AccessLog) bool {
	if al == nil {
		return true
	}

	return (al.Timestamp == "" &&
		al.Authority == "" &&
		al.BytesReceived == "" &&
		al.BytesSent == "" &&
		al.DownstreamLocal == "" &&
		al.DownstreamRemote == "" &&
		al.Duration == "" &&
		al.ForwardedFor == "" &&
		al.Method == "" &&
		al.MixerStatus == "" &&
		al.Protocol == "" &&
		al.RequestId == "" &&
		al.RequestedServer == "" &&
		al.ResponseFlags == "" &&
		al.RouteName == "" &&
		al.StatusCode == "" &&
		al.TcpServiceTime == "" &&
		al.UpstreamCluster == "" &&
		al.UpstreamFailureReason == "" &&
		al.UpstreamLocal == "" &&
		al.UpstreamService == "" &&
		al.UpstreamServiceTime == "" &&
		al.UriParam == "" &&
		al.UriPath == "" &&
		al.UserAgent == "")
}

func (in *WorkloadService) fetchWorkloadsFromCluster(ctx context.Context, cluster string, namespace string, labelSelector string) (models.Workloads, error) {
	var pods []core_v1.Pod
	var repcon []core_v1.ReplicationController
	var dep []apps_v1.Deployment
	var repset []apps_v1.ReplicaSet
	var depcon []osapps_v1.DeploymentConfig
	var fulset []apps_v1.StatefulSet
	var jbs []batch_v1.Job
	var conjbs []batch_v1.CronJob
	var daeset []apps_v1.DaemonSet
	var wgroups []*networking_v1.WorkloadGroup
	var wentries []*networking_v1.WorkloadEntry
	var sidecars []*networking_v1.Sidecar

	ws := models.Workloads{}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	// we've already established the user has access to the namespace; use SA client to obtain namespace resource info
	client, ok := in.kialiSAClients[cluster]
	if !ok {
		return nil, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	kubeCache := in.cache.GetKubeCaches()[cluster]
	if kubeCache == nil {
		return nil, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	wg := sync.WaitGroup{}
	wg.Add(12)
	errChan := make(chan error, 12)

	// Pods are always fetched
	go func() {
		defer wg.Done()
		var err error
		pods, err = kubeCache.GetPods(namespace, labelSelector)
		if err != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	// Deployments are always fetched
	go func() {
		defer wg.Done()
		var err error
		dep, err = kubeCache.GetDeployments(namespace)
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	// ReplicaSets are always fetched
	go func() {
		defer wg.Done()
		var err error
		repset, err = kubeCache.GetReplicaSets(namespace)
		if err != nil {
			log.Errorf("Error fetching ReplicaSets per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	// ReplicaControllers are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if in.isWorkloadIncluded(kubernetes.ReplicationControllerType) {
			// No Cache for ReplicationControllers
			repcon, err = client.GetReplicationControllers(namespace)
			if err != nil {
				log.Errorf("Error fetching GetReplicationControllers per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// DeploymentConfigs are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if client.IsOpenShift() && in.isWorkloadIncluded(kubernetes.DeploymentConfigType) {
			// No cache for DeploymentConfigs
			depcon, err = client.GetDeploymentConfigs(ctx, namespace)
			if err != nil {
				log.Errorf("Error fetching DeploymentConfigs per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// StatefulSets are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if in.isWorkloadIncluded(kubernetes.StatefulSetType) {
			fulset, err = kubeCache.GetStatefulSets(namespace)
			if err != nil {
				log.Errorf("Error fetching StatefulSets per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// CronJobs are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if in.isWorkloadIncluded(kubernetes.CronJobType) {
			// No cache for Cronjobs
			conjbs, err = client.GetCronJobs(namespace)
			if err != nil {
				log.Errorf("Error fetching CronJobs per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// Jobs are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if in.isWorkloadIncluded(kubernetes.JobType) {
			// No cache for Jobs
			jbs, err = client.GetJobs(namespace)
			if err != nil {
				log.Errorf("Error fetching Jobs per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// DaemonSets are fetched only when included
	go func() {
		defer wg.Done()

		var err error
		if in.isWorkloadIncluded(kubernetes.DaemonSetType) {
			daeset, err = kubeCache.GetDaemonSets(namespace)
			if err != nil {
				log.Errorf("Error fetching DaemonSets per namespace %s: %s", namespace, err)
			}
		}
	}()

	// WorkloadGroups are fetched only when included
	go func() {
		defer wg.Done()
		var err error
		if in.isWorkloadIncluded(kubernetes.WorkloadGroupType) {
			wgroups, err = kubeCache.GetWorkloadGroups(namespace, labelSelector)
			if err != nil {
				log.Errorf("Error fetching WorkloadGroups per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// WorkloadEntries are fetched only when included
	go func() {
		defer wg.Done()
		var err error
		if in.isWorkloadIncluded(kubernetes.WorkloadEntryType) {
			wentries, err = kubeCache.GetWorkloadEntries(namespace, labelSelector)
			if err != nil {
				log.Errorf("Error fetching WorkloadEntries per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	// Sidecars are fetched only when included
	go func() {
		defer wg.Done()
		var err error
		if in.isWorkloadIncluded(kubernetes.SidecarType) {
			sidecars, err = kubeCache.GetSidecars(namespace, "")
			if err != nil {
				log.Errorf("Error fetching Sidecars per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return ws, err
	}

	// Key: name of controller; Value: GroupVersionKind of controller
	controllers := map[string]schema.GroupVersionKind{}

	// Find controllers from pods
	for _, pod := range pods {
		if len(pod.OwnerReferences) != 0 {
			for _, ref := range pod.OwnerReferences {
				refGV, err := schema.ParseGroupVersion(ref.APIVersion)
				if err != nil {
					log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
					continue
				}
				if ref.Controller != nil && *ref.Controller && in.isWorkloadIncluded(ref.Kind) {
					if _, exist := controllers[ref.Name]; !exist {
						controllers[ref.Name] = refGV.WithKind(ref.Kind)
					} else {
						if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
							controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].Kind, ref.Kind))
						}
					}
				}
			}
		} else {
			if _, exist := controllers[pod.Name]; !exist {
				// Pod without controller
				controllers[pod.Name] = kubernetes.Pods
			}
		}
	}

	// Find controllers from WorkloadGroups
	for _, wgroup := range wgroups {
		if _, exist := controllers[wgroup.Name]; !exist {
			controllers[wgroup.Name] = kubernetes.WorkloadGroups
		}
	}

	// Resolve ReplicaSets from Deployments
	// Resolve ReplicationControllers from DeploymentConfigs
	// Resolve Jobs from CronJobs
	for controllerName, controllerGVK := range controllers {
		if controllerGVK == kubernetes.ReplicaSets {
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repset[iFound].OwnerReferences) > 0 {
				for _, ref := range repset[iFound].OwnerReferences {
					if ref.Controller != nil && *ref.Controller {
						refGV, err := schema.ParseGroupVersion(ref.APIVersion)
						if err != nil {
							log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
							continue
						}
						if _, exist := controllers[ref.Name]; !exist {
							// For valid owner controllers, delete the child ReplicaSet and add the parent controller,
							// otherwise (for custom controllers), defer to the replica set.
							if in.isWorkloadValid(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(ref.Kind)
								delete(controllers, controllerName)
							} else {
								log.Debugf("Add ReplicaSet to workload list for custom controller [%s][%s]", ref.Name, ref.Kind)
							}
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].Kind, ref.Kind))
							}
							delete(controllers, controllerName)
						}
					}
				}
			}
		}
		if controllerGVK == kubernetes.ReplicationControllers {
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repcon[iFound].OwnerReferences) > 0 {
				for _, ref := range repcon[iFound].OwnerReferences {
					refGV, err := schema.ParseGroupVersion(ref.APIVersion)
					if err != nil {
						log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
						continue
					}
					if ref.Controller != nil && *ref.Controller {
						// Delete the child ReplicationController and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = refGV.WithKind(ref.Kind)
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].Kind, ref.Kind))
							}
						}
						delete(controllers, controllerName)
					}
				}
			}
		}
		if controllerGVK == kubernetes.Jobs {
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(jbs[iFound].OwnerReferences) > 0 {
				for _, ref := range jbs[iFound].OwnerReferences {
					refGV, err := schema.ParseGroupVersion(ref.APIVersion)
					if err != nil {
						log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
						continue
					}
					if ref.Controller != nil && *ref.Controller {
						// Delete the child Job and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = refGV.WithKind(ref.Kind)
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].Kind, ref.Kind))
							}
						}
						// Jobs are special as deleting CronJob parent doesn't delete children
						// So we need to check that parent exists before to delete children controller
						cnExist := false
						for _, cnj := range conjbs {
							if cnj.Name == ref.Name {
								cnExist = true
								break
							}
						}
						if cnExist {
							delete(controllers, controllerName)
						}
					}
				}
			}
		}
	}

	// Cornercase, check for controllers without pods, to show them as a workload
	var selector labels.Selector
	var selErr error
	if labelSelector != "" {
		selector, selErr = labels.Parse(labelSelector)
		if selErr != nil {
			log.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
		}
	}
	for _, d := range dep {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(d.Spec.Template.Labels))
		}
		if _, exist := controllers[d.Name]; !exist && selectorCheck {
			controllers[d.Name] = kubernetes.Deployments
		}
	}
	for _, rs := range repset {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(rs.Spec.Template.Labels))
		}
		if _, exist := controllers[rs.Name]; !exist && len(rs.OwnerReferences) == 0 && selectorCheck {
			controllers[rs.Name] = kubernetes.ReplicaSets
		}
	}
	for _, dc := range depcon {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(dc.Spec.Template.Labels))
		}
		if _, exist := controllers[dc.Name]; !exist && selectorCheck {
			controllers[dc.Name] = kubernetes.DeploymentConfigs
		}
	}
	for _, rc := range repcon {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(rc.Spec.Template.Labels))
		}
		if _, exist := controllers[rc.Name]; !exist && len(rc.OwnerReferences) == 0 && selectorCheck {
			controllers[rc.Name] = kubernetes.ReplicationControllers
		}
	}
	for _, fs := range fulset {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(fs.Spec.Template.Labels))
		}
		if _, exist := controllers[fs.Name]; !exist && selectorCheck {
			controllers[fs.Name] = kubernetes.StatefulSets
		}
	}
	for _, ds := range daeset {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(ds.Spec.Template.Labels))
		}
		if _, exist := controllers[ds.Name]; !exist && selectorCheck {
			controllers[ds.Name] = kubernetes.DaemonSets
		}
	}

	// Build workloads from controllers
	var controllerNames []string
	for k := range controllers {
		controllerNames = append(controllerNames, k)
	}
	sort.Strings(controllerNames)
	for _, controllerName := range controllerNames {
		w := &models.Workload{
			Pods:     models.Pods{},
			Services: []models.ServiceOverview{},
		}
		w.Cluster = cluster
		w.Namespace = namespace
		controllerGVK := controllers[controllerName]
		// Flag to add a controller if it is found
		cnFound := true
		switch controllerGVK {
		case kubernetes.Deployments:
			found := false
			iFound := -1
			for i, dp := range dep {
				if dp.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(dep[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDeployment(&dep[iFound])
			} else {
				log.Errorf("Workload %s is not found as Deployment", controllerName)
				cnFound = false
			}
		case kubernetes.ReplicaSets:
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseReplicaSet(&repset[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicaSet", controllerName)
				cnFound = false
			}
		case kubernetes.ReplicationControllers:
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repcon[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseReplicationController(&repcon[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicationController", controllerName)
				cnFound = false
			}
		case kubernetes.DeploymentConfigs:
			found := false
			iFound := -1
			for i, dc := range depcon {
				if dc.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(depcon[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDeploymentConfig(&depcon[iFound])
			} else {
				log.Errorf("Workload %s is not found as DeploymentConfig", controllerName)
				cnFound = false
			}
		case kubernetes.StatefulSets:
			found := false
			iFound := -1
			for i, fs := range fulset {
				if fs.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(fulset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseStatefulSet(&fulset[iFound])
			} else {
				log.Errorf("Workload %s is not found as StatefulSet", controllerName)
				cnFound = false
			}
		case kubernetes.Pods:
			found := false
			iFound := -1
			for i, pod := range pods {
				if pod.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				w.SetPods([]core_v1.Pod{pods[iFound]})
				w.ParsePod(&pods[iFound])
			} else {
				log.Errorf("Workload %s is not found as Pod", controllerName)
				cnFound = false
			}
		case kubernetes.Jobs:
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(jbs[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseJob(&jbs[iFound])
			} else {
				log.Errorf("Workload %s is not found as Job", controllerName)
				cnFound = false
			}
		case kubernetes.CronJobs:
			found := false
			iFound := -1
			for i, cjb := range conjbs {
				if cjb.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(conjbs[iFound].Spec.JobTemplate.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseCronJob(&conjbs[iFound])
			} else {
				log.Warningf("Workload %s is not found as CronJob (CronJob could be deleted but children are still in the namespace)", controllerName)
				cnFound = false
			}
		case kubernetes.DaemonSets:
			found := false
			iFound := -1
			for i, ds := range daeset {
				if ds.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(daeset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDaemonSet(&daeset[iFound])
			} else {
				log.Errorf("Workload %s is not found as DaemonSet", controllerName)
				cnFound = false
			}
		case kubernetes.WorkloadGroups:
			found := false
			iFound := -1
			for i, wgroup := range wgroups {
				if wgroup.Name == controllerName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				if wgroups[iFound].Spec.Metadata != nil {
					selector := labels.Set(wgroups[iFound].Spec.Metadata.Labels).AsSelector()
					w.ParseWorkloadGroup(wgroups[iFound], kubernetes.FilterWorkloadEntriesBySelector(selector, wentries), kubernetes.FilterSidecarsBySelector(selector.String(), sidecars))
				} else {
					w.ParseWorkloadGroup(wgroups[iFound], []*networking_v1.WorkloadEntry{}, []*networking_v1.Sidecar{})
				}
			} else {
				log.Errorf("Workload %s is not found as WorkloadGroup", controllerName)
				cnFound = false
			}
		default:
			// This covers the scenario of a custom controller without replicaset, controlling pods directly.
			// Note that a custom controller with replicaset(s) will return the replicaset(s) as the workloads.
			var cPods []core_v1.Pod
			cPods = kubernetes.FilterPodsByController(controllerName, controllerGVK, pods)
			if len(cPods) > 0 {
				w.ParsePods(controllerName, controllerGVK, cPods)
				log.Debugf("Workload %s of type %s has no ReplicaSet as a child controller (this may be ok, but is unusual)", controllerName, controllerGVK)
			}
			w.SetPods(cPods)
		}

		// Add the Proxy Status to the workload
		for _, pod := range w.Pods {
			isWaypoint := w.IsWaypoint()
			if config.Get().ExternalServices.Istio.IstioAPIEnabled && (pod.HasIstioSidecar() || isWaypoint) {
				pod.ProxyStatus = in.businessLayer.ProxyStatus.GetPodProxyStatus(cluster, namespace, pod.Name, !isWaypoint)
			}
			// Add the Proxy Status to the workload
			if pod.AmbientEnabled() {
				w.WaypointWorkloads = in.GetWaypointsForWorkload(ctx, *w, false)
			}
		}

		if cnFound {
			ws = append(ws, w)
		}
	}
	return ws, nil
}

func (in *WorkloadService) fetchWorkload(ctx context.Context, criteria WorkloadCriteria) (*models.Workload, error) {
	var pods []core_v1.Pod
	var repcon []core_v1.ReplicationController
	var dep *apps_v1.Deployment
	var repset []apps_v1.ReplicaSet
	var depcon *osapps_v1.DeploymentConfig
	var fulset *apps_v1.StatefulSet
	var jbs []batch_v1.Job
	var conjbs []batch_v1.CronJob
	var ds *apps_v1.DaemonSet
	var wgroup *networking_v1.WorkloadGroup
	var wentries []*networking_v1.WorkloadEntry
	var sidecars []*networking_v1.Sidecar

	wl := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Cluster:   criteria.Cluster,
			Namespace: criteria.Namespace,
		},
		Pods:              models.Pods{},
		Services:          []models.ServiceOverview{},
		Runtimes:          []models.Runtime{},
		AdditionalDetails: []models.AdditionalItem{},
		Health:            *models.EmptyWorkloadHealth(),
	}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, criteria.Namespace, criteria.Cluster); err != nil {
		return nil, err
	}

	// Flag used for custom controllers
	// i.e. a third party framework creates its own "Deployment" controller with extra features
	// on this case, Kiali will collect basic info from the ReplicaSet controller
	_, knownWorkloadType := controllerOrder[criteria.WorkloadGVK.Kind]

	wg := sync.WaitGroup{}
	wg.Add(12)
	errChan := make(chan error, 12)

	kialiCache, err := in.cache.GetKubeCache(criteria.Cluster)
	if err != nil {
		return nil, err
	}

	// we've already established the user has access to the namespace; use SA client to obtain namespace resource info
	client, ok := in.kialiSAClients[criteria.Cluster]
	if !ok {
		return nil, fmt.Errorf("no SA client for cluster [%s]", criteria.Cluster)
	}

	// Pods are always fetched for all workload types
	go func() {
		defer wg.Done()
		var err error
		pods, err = kialiCache.GetPods(criteria.Namespace, "")
		if err != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", criteria.Namespace, err)
			errChan <- err
		}
	}()

	// fetch as WorkloadGroup when workloadType is WorkloadGroups or unspecified
	go func() {
		defer wg.Done()
		var err error

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.WorkloadGroups {
			return
		}
		wgroup, err = kialiCache.GetWorkloadGroup(criteria.Namespace, criteria.WorkloadName)
		if err != nil {
			if errors.IsNotFound(err) {
				wgroup = nil
			} else {
				log.Errorf("Error fetching WorkloadGroup per namespace %s and name %s: %s", criteria.Namespace, criteria.WorkloadName, err)
				errChan <- err
			}
		}
	}()

	// fetch as WorkloadEntries when workloadType is WorkloadGroups or unspecified
	go func() {
		defer wg.Done()
		var err error

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.WorkloadGroups {
			return
		}
		wentries, err = kialiCache.GetWorkloadEntries(criteria.Namespace, "")
		if err != nil {
			if errors.IsNotFound(err) {
				wentries = nil
			} else {
				log.Errorf("Error fetching WorkloadEntry per namespace %s: %s", criteria.Namespace, err)
				errChan <- err
			}
		}
	}()

	// fetch as Sidecars when workloadType is WorkloadGroups or unspecified
	go func() {
		defer wg.Done()
		var err error

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.WorkloadGroups {
			return
		}
		sidecars, err = kialiCache.GetSidecars(criteria.Namespace, "")
		if err != nil {
			if errors.IsNotFound(err) {
				sidecars = nil
			} else {
				log.Errorf("Error fetching Sidecars per namespace %s: %s", criteria.Namespace, err)
				errChan <- err
			}
		}
	}()

	// fetch as Deployment when workloadType is Deployment or unspecified
	go func() {
		defer wg.Done()
		var err error

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.Deployments {
			return
		}
		dep, err = kialiCache.GetDeployment(criteria.Namespace, criteria.WorkloadName)
		if err != nil {
			if errors.IsNotFound(err) {
				dep = nil
			} else {
				log.Errorf("Error fetching Deployment per namespace %s and name %s: %s", criteria.Namespace, criteria.WorkloadName, err)
				errChan <- err
			}
		}
	}()

	// fetch as ReplicaSet(s) when workloadType is ReplicaSet, unspecified, *or custom*
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.ReplicaSets && knownWorkloadType {
			return
		}
		var err error
		repset, err = kialiCache.GetReplicaSets(criteria.Namespace)
		if err != nil {
			log.Errorf("Error fetching ReplicaSets per namespace %s: %s", criteria.Namespace, err)
			errChan <- err
		}
	}()

	// fetch as ReplicationControllerType when included, and workloadType is ReplicationControllerType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.ReplicationControllers {
			return
		}

		var err error
		if in.isWorkloadIncluded(kubernetes.ReplicationControllerType) {
			// No cache for ReplicationControllers
			repcon, err = client.GetReplicationControllers(criteria.Namespace)
			if err != nil {
				log.Errorf("Error fetching GetReplicationControllers per namespace %s: %s", criteria.Namespace, err)
				errChan <- err
			}
		}
	}()

	// fetch as DeploymentConfigType when included, and workloadType is DeploymentConfigType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.DeploymentConfigs {
			return
		}

		var err error
		if client.IsOpenShift() && in.isWorkloadIncluded(kubernetes.DeploymentConfigType) {
			// No cache for deploymentConfigs
			depcon, err = client.GetDeploymentConfig(ctx, criteria.Namespace, criteria.WorkloadName)
			if err != nil {
				depcon = nil
			}
		}
	}()

	// fetch as StatefulSetType when included, and workloadType is StatefulSetType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.StatefulSets {
			return
		}

		var err error
		if in.isWorkloadIncluded(kubernetes.StatefulSetType) {
			fulset, err = kialiCache.GetStatefulSet(criteria.Namespace, criteria.WorkloadName)
			if err != nil {
				fulset = nil
			}
		}
	}()

	// fetch as CronJobType when included, and workloadType is CronJobType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.CronJobs {
			return
		}

		var err error
		if in.isWorkloadIncluded(kubernetes.CronJobType) {
			// No cache for CronJobs
			conjbs, err = client.GetCronJobs(criteria.Namespace)
			if err != nil {
				log.Errorf("Error fetching CronJobs per namespace %s: %s", criteria.Namespace, err)
				errChan <- err
			}
		}
	}()

	// fetch as JobType when included, and workloadType is JobType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.Jobs {
			return
		}

		var err error
		if in.isWorkloadIncluded(kubernetes.JobType) {
			// No cache for Jobs
			jbs, err = client.GetJobs(criteria.Namespace)
			if err != nil {
				log.Errorf("Error fetching Jobs per namespace %s: %s", criteria.Namespace, err)
				errChan <- err
			}
		}
	}()

	// fetch as DaemonSetType when included, and workloadType is DaemonSetType or unspecified
	go func() {
		defer wg.Done()

		if criteria.WorkloadGVK.Kind != "" && criteria.WorkloadGVK != kubernetes.DaemonSets {
			return
		}

		var err error
		if in.isWorkloadIncluded(kubernetes.DaemonSetType) {
			ds, err = kialiCache.GetDaemonSet(criteria.Namespace, criteria.WorkloadName)
			if err != nil {
				ds = nil
			}
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return wl, err
	}

	// Key: name of controller; Value: GVK of controller
	controllers := map[string]schema.GroupVersionKind{}

	// Find controllers from pods
	for _, pod := range pods {
		if len(pod.OwnerReferences) != 0 {
			for _, ref := range pod.OwnerReferences {
				refGV, err := schema.ParseGroupVersion(ref.APIVersion)
				if err != nil {
					log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
					continue
				}
				if ref.Controller != nil && *ref.Controller && in.isWorkloadIncluded(ref.Kind) {
					if _, exist := controllers[ref.Name]; !exist {
						controllers[ref.Name] = refGV.WithKind(ref.Kind)
					} else {
						if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
							controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].String(), ref.Kind))
						}
					}
				}
			}
		} else {
			if _, exist := controllers[pod.Name]; !exist {
				// Pod without controller
				controllers[pod.Name] = kubernetes.Pods
			}
		}
	}

	// Find controllers from WorkloadGroups
	if wgroup != nil {
		if _, exist := controllers[wgroup.Name]; !exist {
			controllers[wgroup.Name] = kubernetes.WorkloadGroups
		}
	}

	// Resolve ReplicaSets from Deployments
	// Resolve ReplicationControllers from DeploymentConfigs
	// Resolve Jobs from CronJobs
	for controllerName, controllerGVK := range controllers {
		if controllerGVK == kubernetes.ReplicaSets {
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repset[iFound].OwnerReferences) > 0 {
				for _, ref := range repset[iFound].OwnerReferences {
					refGV, err := schema.ParseGroupVersion(ref.APIVersion)
					if err != nil {
						log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
						continue
					}
					if ref.Controller != nil && *ref.Controller {
						// For valid owner controllers, delete the child ReplicaSet and add the parent controller,
						// otherwise (for custom controllers), defer to the replica set.
						if _, exist := controllers[ref.Name]; !exist {
							if in.isWorkloadValid(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(ref.Kind)
								delete(controllers, controllerName)
							} else {
								log.Debugf("Use ReplicaSet as workload for custom controller [%s][%s]", ref.Name, ref.Kind)
							}
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].Kind, ref.Kind))
							}
							delete(controllers, controllerName)
						}
					}
				}
			}
		}
		if controllerGVK == kubernetes.ReplicationControllers {
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repcon[iFound].OwnerReferences) > 0 {
				for _, ref := range repcon[iFound].OwnerReferences {
					refGV, err := schema.ParseGroupVersion(ref.APIVersion)
					if err != nil {
						log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
						continue
					}
					if ref.Controller != nil && *ref.Controller {
						// Delete the child ReplicationController and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = refGV.WithKind(ref.Kind)
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].String(), ref.Kind))
							}
						}
						delete(controllers, controllerName)
					}
				}
			}
		}
		if controllerGVK == kubernetes.Jobs {
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == controllerName {
					iFound = i
					found = true
					break
				}
			}
			if found && len(jbs[iFound].OwnerReferences) > 0 {
				for _, ref := range jbs[iFound].OwnerReferences {
					refGV, err := schema.ParseGroupVersion(ref.APIVersion)
					if err != nil {
						log.Errorf("could not parse OwnerReference api version %q: %v", ref.APIVersion, err)
						continue
					}
					if ref.Controller != nil && *ref.Controller {
						// Delete the child Job and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = refGV.WithKind(ref.Kind)
						} else {
							if controllers[ref.Name] != refGV.WithKind(ref.Kind) {
								controllers[ref.Name] = refGV.WithKind(controllerPriority(controllers[ref.Name].String(), ref.Kind))
							}
						}
						// Jobs are special as deleting CronJob parent doesn't delete children
						// So we need to check that parent exists before to delete children controller
						cnExist := false
						for _, cnj := range conjbs {
							if cnj.Name == ref.Name {
								cnExist = true
								break
							}
						}
						if cnExist {
							delete(controllers, controllerName)
						}
					}
				}
			}
		}
	}

	// Cornercase, check for controllers without pods, to show them as a workload
	if dep != nil {
		if _, exist := controllers[dep.Name]; !exist {
			controllers[dep.Name] = kubernetes.Deployments
		}
	}
	for _, rs := range repset {
		if _, exist := controllers[rs.Name]; !exist && len(rs.OwnerReferences) == 0 {
			controllers[rs.Name] = kubernetes.ReplicaSets
		}
	}
	if depcon != nil {
		if _, exist := controllers[depcon.Name]; !exist {
			controllers[depcon.Name] = kubernetes.DeploymentConfigs
		}
	}
	for _, rc := range repcon {
		if _, exist := controllers[rc.Name]; !exist && len(rc.OwnerReferences) == 0 {
			controllers[rc.Name] = kubernetes.ReplicationControllers
		}
	}
	if fulset != nil {
		if _, exist := controllers[fulset.Name]; !exist {
			controllers[fulset.Name] = kubernetes.StatefulSets
		}
	}
	if ds != nil {
		if _, exist := controllers[ds.Name]; !exist {
			controllers[ds.Name] = kubernetes.DaemonSets
		}
	}

	// Build workload from controllers

	if _, exist := controllers[criteria.WorkloadName]; exist {
		w := models.Workload{
			WorkloadListItem: models.WorkloadListItem{
				Cluster:   criteria.Cluster,
				Namespace: criteria.Namespace,
			},
			Pods:              models.Pods{},
			Services:          []models.ServiceOverview{},
			Runtimes:          []models.Runtime{},
			AdditionalDetails: []models.AdditionalItem{},
			Health:            *models.EmptyWorkloadHealth(),
		}

		// We have a controller with criteria.workloadName but if criteria.WorkloadType is specified and does
		// not match then we may not yet have fetched the workload definition.
		// For known types: respect criteria.WorkloadType and return NotFound if necessary.
		// For custom types: fall through to the default handler and try to get the workload definition working
		// up from the pods or replicas sets.
		// see https://github.com/kiali/kiali/issues/3830
		discoveredControllerGVK := controllers[criteria.WorkloadName]
		controllerGVK := discoveredControllerGVK
		if criteria.WorkloadGVK.Kind != "" && discoveredControllerGVK != criteria.WorkloadGVK {
			controllerGVK = criteria.WorkloadGVK
		}

		// Handle the known types...
		cnFound := true
		switch controllerGVK {
		case kubernetes.Deployments:
			if dep != nil && dep.Name == criteria.WorkloadName {
				selector := labels.Set(dep.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDeployment(dep)
			} else {
				log.Errorf("Workload %s is not found as Deployment", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.ReplicaSets:
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == criteria.WorkloadName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseReplicaSet(&repset[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicaSet", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.ReplicationControllers:
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == criteria.WorkloadName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repcon[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseReplicationController(&repcon[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicationController", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.DeploymentConfigs:
			if depcon != nil && depcon.Name == criteria.WorkloadName {
				selector := labels.Set(depcon.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDeploymentConfig(depcon)
			} else {
				log.Errorf("Workload %s is not found as DeploymentConfig", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.StatefulSets:
			if fulset != nil && fulset.Name == criteria.WorkloadName {
				selector := labels.Set(fulset.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseStatefulSet(fulset)
			} else {
				log.Errorf("Workload %s is not found as StatefulSet", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.Pods:
			found := false
			iFound := -1
			for i, pod := range pods {
				if pod.Name == criteria.WorkloadName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				w.SetPods([]core_v1.Pod{pods[iFound]})
				w.ParsePod(&pods[iFound])
			} else {
				log.Errorf("Workload %s is not found as Pod", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.Jobs:
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == criteria.WorkloadName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(jbs[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseJob(&jbs[iFound])
			} else {
				log.Errorf("Workload %s is not found as Job", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.CronJobs:
			found := false
			iFound := -1
			for i, cjb := range conjbs {
				if cjb.Name == criteria.WorkloadName {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(conjbs[iFound].Spec.JobTemplate.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseCronJob(&conjbs[iFound])
			} else {
				log.Warningf("Workload %s is not found as CronJob (CronJob could be deleted but children are still in the namespace)", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.DaemonSets:
			if ds != nil && ds.Name == criteria.WorkloadName {
				selector := labels.Set(ds.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsBySelector(selector, pods))
				w.ParseDaemonSet(ds)
			} else {
				log.Errorf("Workload %s is not found as DaemonSet", criteria.WorkloadName)
				cnFound = false
			}
		case kubernetes.WorkloadGroups:
			if wgroup != nil && wgroup.Name == criteria.WorkloadName {
				if wgroup.Spec.Metadata != nil {
					selector := labels.Set(wgroup.Spec.Metadata.Labels).AsSelector()
					w.ParseWorkloadGroup(wgroup, kubernetes.FilterWorkloadEntriesBySelector(selector, wentries), kubernetes.FilterSidecarsBySelector(selector.String(), sidecars))
				} else {
					w.ParseWorkloadGroup(wgroup, []*networking_v1.WorkloadEntry{}, []*networking_v1.Sidecar{})
				}
			} else {
				log.Errorf("Workload %s is not found as WorkloadGroup", criteria.WorkloadName)
				cnFound = false
			}
		default:
			// Handle a custom type (criteria.WorkloadType is not a known type).
			// 1. Custom controller with replicaset
			// 2. Custom controller without replicaset controlling pods directly

			// 1. use the controller type found in the Pod resolution and ignore the unknown criteria type
			var cPods []core_v1.Pod
			for _, rs := range repset {
				if discoveredControllerGVK.Kind == kubernetes.ReplicaSetType && criteria.WorkloadName == rs.Name {
					w.ParseReplicaSet(&rs)
				} else {
					rsOwnerRef := meta_v1.GetControllerOf(&rs.ObjectMeta)
					if rsOwnerRef != nil && rsOwnerRef.Name == criteria.WorkloadName && rsOwnerRef.Kind == discoveredControllerGVK.Kind {
						w.ParseReplicaSetParent(&rs, criteria.WorkloadName, discoveredControllerGVK)
					} else {
						continue
					}
				}
				for _, pod := range pods {
					if meta_v1.IsControlledBy(&pod, &rs) {
						cPods = append(cPods, pod)
					}
				}
				break
			}

			// 2. If no pods we're found for a ReplicaSet type, it's possible the controller
			//    is managing the pods itself i.e. the pod's have an owner ref directly to the controller type.
			if len(cPods) == 0 {
				cPods = kubernetes.FilterPodsByController(criteria.WorkloadName, discoveredControllerGVK, pods)
				if len(cPods) > 0 {
					w.ParsePods(criteria.WorkloadName, discoveredControllerGVK, cPods)
					log.Debugf("Workload %s of type %s has not a ReplicaSet as a child controller, it may need a revisit", criteria.WorkloadName, discoveredControllerGVK)
				}
			}

			w.SetPods(cPods)
		}

		w.WorkloadListItem.IsGateway = w.IsGateway()
		isWaypoint := w.IsWaypoint()
		w.WorkloadListItem.IsWaypoint = isWaypoint
		w.WorkloadListItem.IsZtunnel = w.IsZtunnel()
		w.WorkloadListItem.IsAmbient = isWaypoint || w.WorkloadListItem.IsZtunnel || w.HasIstioAmbient()

		// Add the Proxy Status to the workload
		for _, pod := range w.Pods {
			if config.Get().ExternalServices.Istio.IstioAPIEnabled && (pod.HasIstioSidecar() || isWaypoint) {
				pod.ProxyStatus = in.businessLayer.ProxyStatus.GetPodProxyStatus(criteria.Cluster, criteria.Namespace, pod.Name, !isWaypoint)
			}
			// If Ambient is enabled for pod, check if has any Waypoint proxy
			if !isWaypoint && pod.AmbientEnabled() && criteria.IncludeWaypoints {
				w.WaypointWorkloads = in.GetWaypointsForWorkload(ctx, w, false)
				// TODO: Maybe user doesn't have permissions
				ztunnelPods := in.cache.GetZtunnelPods(criteria.Cluster)
				for _, zPod := range ztunnelPods {
					// There should be a ztunnel pod per node
					// The information should be the same, but choosing the pod could help to verify the information is synchronized
					zPodConfig := in.cache.GetZtunnelDump(criteria.Cluster, zPod.Namespace, zPod.Name)
					if zPodConfig != nil {
						w.AddPodsProtocol(*zPodConfig)
					}
				}

			}
		}

		// If the pod is a waypoint proxy, check if it is attached to a namespace or to a service account, and get the affected workloads
		if isWaypoint && criteria.IncludeWaypoints {
			if w.WaypointFor() != config.WaypointForNone {
				includeServices := false
				if w.WaypointFor() == config.WaypointForService || w.WaypointFor() == config.WaypointForAll {
					includeServices = true
				}
				// Get waypoint workloads
				in.cache.GetWaypointList()
				waypointWorkloads, waypointServices := in.listWaypointWorkloads(ctx, w.Name, w.Namespace, criteria.Cluster, includeServices)
				w.WaypointWorkloads = waypointWorkloads
				if includeServices {
					w.WaypointServices = waypointServices
				}
			}
		}

		if cnFound {
			return &w, nil
		}
	}
	return wl, kubernetes.NewNotFound(criteria.WorkloadName, "Kiali", "Workload")
}

func (in *WorkloadService) GetZtunnelConfig(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump {

	return in.cache.GetZtunnelDump(cluster, namespace, pod)

}

// GetWaypoints: Return the list of waypoint workloads.  This looks for all k8s gateways and then tests their labels
func (in *WorkloadService) GetWaypoints(ctx context.Context) models.Workloads {
	if !in.cache.IsWaypointListExpired() {
		log.Tracef("GetWaypoints: Returning list from cache")
		return in.cache.GetWaypointList()
	}

	waypoints := []*models.Workload{}

	for cluster := range in.userClients {
		gateways, err := in.GetAllWorkloads(ctx, cluster, config.GatewayLabel)
		if err != nil {
			log.Debugf("GetWaypoints: Error fetching k8s gateway workloads for cluster=[%s]: %s", cluster, err.Error())
			continue
		}

		clusterWaypoints := sliceutil.Filter(gateways, func(gw *models.Workload) bool { return gw.IsWaypoint() })
		waypoints = append(waypoints, clusterWaypoints...)
	}
	in.cache.SetWaypointList(waypoints)
	return waypoints
}

// getCapturingWaypoints returns waypoint references that capture the workload. Only the active waypoint is returned unless <all>
// is true, in which case all capturing waypoints will be returned. If so, they are returned in order of priority, so [0]
// reflects the active waypoint, the others have been overriden.
func (in *WorkloadService) getCapturingWaypoints(ctx context.Context, workload models.Workload, all bool) ([]models.Waypoint, bool) {
	waypoints := make([]models.Waypoint, 0, 3)

	// the highest override is at the pod level. for Pod workloads, check labels on the pod. for other workload
	// types check the template labels, which we assume will be consistently applied to the pods (Kiali doesn't
	// really deal at the pod level, and won't deal with any sort on manually applied label on pod managed by a
	// higher-level workload type).
	waypointUse, waypointUseFound := workload.TemplateLabels[config.WaypointUseLabel]
	waypointUseNamespace, waypointUseNamespaceFound := workload.TemplateLabels[config.WaypointUseNamespaceLabel]
	if workload.WorkloadGVK.Kind == kubernetes.PodType {
		waypointUse, waypointUseFound = workload.Labels[config.WaypointUseLabel]
		waypointUseNamespace, waypointUseNamespaceFound = workload.Labels[config.WaypointUseNamespaceLabel]
	}
	if waypointUseFound {
		// if the workload opts-out from waypoint capture, then we are done
		// note: this opt-out is currently undocumented but exists (2/14/25)
		if waypointUse == config.WaypointNone {
			return waypoints, false
		}
		if !waypointUseNamespaceFound {
			waypointUseNamespace = workload.Namespace
		}
		// Ambient doesn't support multicluster (For now), cluster is the same as the workload
		waypoints = append(waypoints, models.Waypoint{Name: waypointUse, Type: "pod", Namespace: waypointUseNamespace, Cluster: workload.Cluster})
		if !all {
			return waypoints, true
		}
	}

	// the next level of override is service level, if necessary, fetch the workload's service
	// - note that workloads with no labels (and therefore no service selector) are not associated with a service
	services := workload.Services
	if len(services) == 0 && len(workload.Labels) > 0 {
		serviceCriteria := ServiceCriteria{
			Cluster:                workload.Cluster,
			Namespace:              workload.Namespace,
			ServiceSelector:        labels.Set(workload.Labels).String(),
			IncludeHealth:          false,
			IncludeOnlyDefinitions: true,
		}
		svc, err := in.businessLayer.Svc.GetServiceList(ctx, serviceCriteria)
		if err != nil {
			log.Debugf("isWorkloadCaptured: Error fetching services %s", err.Error())
		}
		// a proper service selector on the workload should, I think, return only a single service (there are ways
		// a workload can map to multiple services, but I think only one should be returned using a proper selector). If
		// multiple were returned I'm not sure how the waypoint capture logic should work, so for now, more than 1 will
		// indicate that the labels did not have a proper service selector. In this case, ignore the returned services.
		if len(svc.Services) > 1 {
			log.Warningf("Ignoring service override for waypoint cature. Found [%d] services for [%s] workload [%s:%s:%s]", len(svc.Services), workload.WorkloadGVK.GroupKind(), workload.Cluster, workload.Namespace, workload.Name)
		} else {
			services = svc.Services
		}
	}
	if len(services) > 0 {
		svc := services[0]
		waypointUse, waypointUseFound = svc.Labels[config.WaypointUseLabel]
		waypointUseNamespace, waypointUseNamespaceFound = svc.Labels[config.WaypointUseNamespaceLabel]
		if waypointUseFound {
			if waypointUse == config.WaypointNone {
				return waypoints, false
			}
			if !waypointUseNamespaceFound {
				waypointUseNamespace = workload.Namespace
			}
			waypoints = append(waypoints, models.Waypoint{Name: waypointUse, Type: "service", Namespace: waypointUseNamespace, Cluster: workload.Cluster})
			if !all {
				return waypoints, true
			}
		}
	}

	// If we don't have a workload or service override, look for a namespace-level waypoint
	if ns, nsFound := in.cache.GetNamespace(workload.Cluster, in.userClients[workload.Cluster].GetToken(), workload.Namespace); nsFound {
		waypointUse, waypointUseFound = ns.Labels[config.WaypointUseLabel]
		waypointUseNamespace, waypointUseNamespaceFound = ns.Labels[config.WaypointUseNamespaceLabel]

		if waypointUseFound {
			if waypointUse == config.WaypointNone {
				return waypoints, false
			}
			if !waypointUseNamespaceFound {
				waypointUseNamespace = workload.Namespace
			}
			waypoints = append(waypoints, models.Waypoint{Name: waypointUse, Type: "namespace", Namespace: waypointUseNamespace, Cluster: workload.Cluster})
			if !all {
				return waypoints, true
			}
		}
	}

	return waypoints, len(waypoints) > 0
}

// GetWaypointsForWorkload Returns the waypoint references capturing the workload. Only the active waypoint is returned unless <all>
// is true, in which case all capturing waypoints will be returned. If so, they are returned in order of priority, so [0]
// reflects the active waypoint, the others have been overriden.
func (in *WorkloadService) GetWaypointsForWorkload(ctx context.Context, workload models.Workload, all bool) []models.WorkloadReferenceInfo {
	workloadsList := []models.WorkloadReferenceInfo{}
	workloadsMap := map[string]bool{} // Ensure unique

	if workload.Labels[config.WaypointUseLabel] == config.WaypointNone {
		return workloadsList
	}

	// get waypoint references for the workload
	waypoints, found := in.getCapturingWaypoints(ctx, workload, all)
	if !found {
		return workloadsList
	}

	// then, get the waypoint workloads to filter out "forNone" waypoints
	for _, waypoint := range waypoints {
		waypointWorkload, err := in.fetchWorkload(ctx, WorkloadCriteria{Cluster: workload.Cluster, Namespace: waypoint.Namespace, WorkloadName: waypoint.Name, WorkloadGVK: schema.GroupVersionKind{}, IncludeWaypoints: false})
		if err != nil {
			log.Debugf("GetWaypointsForWorkload: Error fetching waypoint workload %s", err.Error())
			return nil
		}
		waypointFor, waypointForFound := waypointWorkload.Labels[config.WaypointFor]
		if !waypointForFound || waypointFor != config.WaypointForNone {
			key := fmt.Sprintf("%s_%s_%s", workload.Cluster, waypoint.Namespace, waypoint.Name)
			if waypointWorkload != nil && !workloadsMap[key] {
				workloadsList = append(workloadsList, models.WorkloadReferenceInfo{Name: waypoint.Name, Namespace: waypoint.Namespace, Cluster: waypoint.Cluster, Type: waypointWorkload.WaypointFor()})
				workloadsMap[key] = true
			}
		}
	}

	return workloadsList
}

// listWaypointWorkloads returns the list of workloads when the waypoint proxy is applied per namespace
// Maybe use some cache?
func (in *WorkloadService) listWaypointWorkloads(ctx context.Context, name, namespace, cluster string, includeServices bool) ([]models.WorkloadReferenceInfo, []models.ServiceReferenceInfo) {
	// Get all the workloads for a namespaces labeled
	labelSelector := fmt.Sprintf("%s=%s", config.WaypointUseLabel, name)
	nslist, errNs := in.userClients[cluster].GetNamespaces(labelSelector)
	if errNs != nil {
		log.Errorf("listWaypointWorkloads: Error fetching namespaces by selector %s", labelSelector)
	}

	var workloadslist []models.WorkloadReferenceInfo
	var servicesList []models.ServiceReferenceInfo
	// This is to verify there is no duplicated services
	servicesMap := make(map[string]bool)

	// Excluded workloads
	excludedWk := make(map[string]bool)
	labelType := "namespace"
	// Get all the workloads for the namespaces that has the waypoint label
	for _, ns := range nslist {
		// If it doesn't have a namespace label, it is the same namespace
		if ns.Name == namespace || ns.Labels[config.WaypointUseNamespaceLabel] == namespace {
			workloadList, err := in.fetchWorkloadsFromCluster(ctx, cluster, ns.Name, "")
			if err != nil {
				log.Debugf("listWaypointWorkloads: Error fetching workloads for namespace %s", ns.Name)
			}
			for _, wk := range workloadList {
				// This annotation disables other labels (Like the ns one)
				if wk.Labels[in.config.IstioLabels.AmbientNamespaceLabel] != "none" && wk.Labels[config.WaypointUseLabel] != config.WaypointNone {
					workloadslist = append(workloadslist, models.WorkloadReferenceInfo{Name: wk.Name, Namespace: wk.Namespace, Labels: wk.Labels, LabelType: labelType, Cluster: wk.Cluster})
				} else {
					excludedWk[wk.Name] = true
				}
			}
		}
	}

	// Get annotated workloads
	namespaces, found := in.cache.GetNamespaces(cluster, in.userClients[cluster].GetToken())
	if found {
		for _, ns := range namespaces {
			wlist, err := in.fetchWorkloadsFromCluster(ctx, cluster, ns.Name, labelSelector)
			if err != nil {
				log.Debugf("listWaypointWorkloads: Error fetching workloads for namespace label selector %s", labelSelector)
			}
			if len(wlist) > 0 {
				labelType = "workload"
			}
			for _, workload := range wlist {
				// none disables the waypoint enrollment
				if workload.Labels[config.WaypointUseLabel] != config.WaypointNone {
					workloadslist = append(workloadslist, models.WorkloadReferenceInfo{Name: workload.Name, Namespace: workload.Namespace, LabelType: labelType, Labels: workload.Labels, Cluster: workload.Cluster})
				} else {
					excludedWk[workload.Name] = true
				}
			}
		}
	}

	// Should include service if the waypoint-for=service|all
	if includeServices {
		// Get the services for the workloads
		var services *models.ServiceList
		var err error

		for _, wl := range workloadslist {
			if !excludedWk[wl.Name] {
				serviceCriteria := ServiceCriteria{
					Cluster:                wl.Cluster,
					Namespace:              wl.Namespace,
					ServiceSelector:        labels.Set(wl.Labels).String(),
					IncludeHealth:          false,
					IncludeOnlyDefinitions: true,
				}
				services, err = in.businessLayer.Svc.GetServiceList(ctx, serviceCriteria)
				if err != nil {
					log.Infof("Error getting services %s", err.Error())
				} else {
					for _, service := range services.Services {
						// waypoints don't capture other waypoints, so skip them
						if config.IsWaypoint(service.Labels) {
							continue
						}
						key := fmt.Sprintf("%s_%s_%s", service.Name, service.Namespace, service.Cluster)
						if !servicesMap[key] && service.Labels[config.WaypointUseLabel] != config.WaypointNone {
							servicesList = append(servicesList, models.ServiceReferenceInfo{Name: service.Name, Namespace: service.Namespace, LabelType: labelType, Cluster: service.Cluster})
							servicesMap[key] = true
						}
					}
				}
			}
		}
		// Get annotated services
		servicesList = append(servicesList, in.businessLayer.Svc.ListWaypointServices(ctx, name, namespace, cluster)...)
	}
	return workloadslist, servicesList
}

func (in *WorkloadService) updateWorkload(ctx context.Context, cluster string, namespace string, workloadName string, workloadGVK schema.GroupVersionKind, jsonPatch string, patchType string) error {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return err
	}

	userClient, ok := in.userClients[cluster]
	if !ok {
		return fmt.Errorf("user client for cluster [%s] not found", cluster)
	}

	workloadGVKs := []schema.GroupVersionKind{
		kubernetes.Deployments,
		kubernetes.ReplicaSets,
		kubernetes.ReplicationControllers,
		kubernetes.DeploymentConfigs,
		kubernetes.StatefulSets,
		kubernetes.Jobs,
		kubernetes.CronJobs,
		kubernetes.Pods,
		kubernetes.DaemonSets,
	}

	// workloadGVK is an optional parameter used to optimize the workload type fetch
	// By default workloads use only the "name" but not the pair "name,type".
	if workloadGVK.Kind != "" {
		found := false
		for _, wt := range workloadGVKs {
			if workloadGVK.Kind == wt.Kind {
				found = true
				break
			}
		}
		if found {
			workloadGVKs = []schema.GroupVersionKind{workloadGVK}
		}
	}

	wg := sync.WaitGroup{}
	wg.Add(len(workloadGVKs))
	errChan := make(chan error, len(workloadGVKs))

	for _, workloadGVK := range workloadGVKs {
		go func(wkGVK schema.GroupVersionKind) {
			defer wg.Done()
			var err error
			if in.isWorkloadIncluded(wkGVK.Kind) {
				err = userClient.UpdateWorkload(namespace, workloadName, wkGVK, jsonPatch, patchType)
			}
			if err != nil {
				if !errors.IsNotFound(err) {
					log.Errorf("Error fetching %s per namespace %s and name %s: %s", wkGVK, namespace, workloadName, err)
					errChan <- err
				}
			}
		}(workloadGVK)
	}

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return err
	}

	return nil
}

// KIALI-1730
// This method is used to decide the priority of the controller in the cornercase when two controllers have same labels
// on the selector. Note that this is a situation that user should control as it is described in the documentation:
// https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
// But Istio only identifies one controller as workload (it doesn't note which one).
// Kiali can select one on the list of workloads and other in the details and this should be consistent.
var controllerOrder = map[string]int{
	"Deployment":            6,
	"DeploymentConfig":      5,
	"ReplicaSet":            4,
	"ReplicationController": 3,
	"StatefulSet":           2,
	"Job":                   1,
	"DaemonSet":             0,
	"Pod":                   -1,
}

func controllerPriority(type1, type2 string) string {
	w1, e1 := controllerOrder[type1]
	if !e1 {
		log.Debugf("This controller %s is assigned in a Pod and it's not properly managed", type1)
	}
	w2, e2 := controllerOrder[type2]
	if !e2 {
		log.Debugf("This controller %s is assigned in a Pod and it's not properly managed", type2)
	}
	if w1 >= w2 {
		return type1
	} else {
		return type2
	}
}

// GetWorkloadTracingName returns a struct with all the information needed for tracing lookup
// The "Application" name (app label) relates to a workload
// If the workload has any Waypoint, the information is included, as it will be the search name in the tracing backend
func (in *WorkloadService) GetWorkloadTracingName(ctx context.Context, cluster, namespace, workload string) (models.TracingName, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetWorkloadTracingName",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("workload", workload),
	)
	defer end()

	tracingName := models.TracingName{Workload: workload}
	wkd, err := in.fetchWorkload(ctx, WorkloadCriteria{Cluster: cluster, Namespace: namespace, WorkloadName: workload, WorkloadGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: ""}, IncludeWaypoints: true})
	if err != nil {
		return tracingName, err
	}

	tracingName.App = workload
	if wkd.IsGateway() || wkd.IsWaypoint() {
		// Waypoints and Gateways doesn't have an app label, but they have valid traces data
		tracingName.Lookup = workload
		return tracingName, nil
	}
	appLabelName, _ := in.config.GetAppLabelName(wkd.Labels)
	app := wkd.Labels[appLabelName]
	tracingName.App = app
	tracingName.Lookup = app

	waypoints := wkd.WaypointWorkloads
	if len(waypoints) > 0 {
		tracingName.WaypointName = waypoints[0].Name
		tracingName.Lookup = waypoints[0].Name
		tracingName.WaypointNamespace = waypoints[0].Namespace
	}

	return tracingName, nil
}

// streamParsedLogs fetches logs from a container in a pod, parses and decorates each log line with some metadata (if possible) and
// sends the processed lines to the client in JSON format. Results are sent as processing is performed, so in case of any error when
// doing processing the JSON document will be truncated.
func (in *WorkloadService) streamParsedLogs(cluster, namespace string, names []string, opts *LogOptions, w http.ResponseWriter) error {
	var userClient kubernetes.ClientInterface
	var ok bool
	if opts.LogType == models.LogTypeZtunnel {
		// Use the SA because the logs will be filtered by the specific workload logs
		userClient, ok = in.kialiSAClients[cluster]
	} else {
		userClient, ok = in.userClients[cluster]
	}
	if !ok {
		return fmt.Errorf("user client for cluster [%s] not found", cluster)
	}

	var engardeParser *parser.Parser
	if opts.LogType == models.LogTypeProxy || opts.LogType == models.LogTypeWaypoint {
		engardeParser = parser.New(parser.IstioProxyAccessLogsPattern)
	}

	k8sOpts := opts.PodLogOptions
	// the k8s API does not support "endTime/beforeTime". So for bounded time ranges we need to
	// discard the logs after sinceTime+duration
	isBounded := opts.Duration != nil

	firstEntry := true
	firstWritter := true
	for i, name := range names {
		logsReader, err := userClient.StreamPodLogs(namespace, name, &k8sOpts)
		if err != nil {
			return err
		}

		defer func() {
			e := logsReader.Close()
			if e != nil {
				log.Errorf("Error when closing the connection streaming logs of a pod: %s", e.Error())
			}
		}()

		bufferedReader := bufio.NewReader(logsReader)

		var startTime *time.Time
		var endTime *time.Time
		if k8sOpts.SinceTime != nil {
			startTime = &k8sOpts.SinceTime.Time
			if isBounded {
				end := startTime.Add(*opts.Duration)
				endTime = &end
			}
		}

		var writeErr error

		if firstWritter {
			// To avoid high memory usage, the JSON will be written
			// to the HTTP Response as it's received from the cluster API.
			// That is, each log line is parsed, decorated with Kiali's metadata,
			// marshalled to JSON and immediately written to the HTTP Response.
			// This means that it is needed to push HTTP headers and start writing
			// the response body right now and any errors at the middle of the log
			// processing can no longer be informed to the client. So, starting
			// these lines, the best we can do if some error happens is to simply
			// log the error and stop/truncate the response, which will have the
			// effect of sending an incomplete JSON document that the browser will fail
			// to parse. Hopefully, the client/UI can catch the parsing error and
			// properly show an error message about the failure retrieving logs.
			w.Header().Set("Content-Type", "application/json")
			_, writeErr = w.Write([]byte("{\"entries\":[")) // This starts the JSON document
			if writeErr != nil {
				return writeErr
			}
			firstWritter = false
		}

		line, readErr := bufferedReader.ReadString('\n')
		linesWritten := 0
		for ; readErr == nil || (readErr == io.EOF && len(line) > 0); line, readErr = bufferedReader.ReadString('\n') {
			// Abort if we already reached the requested max-lines limit
			if opts.MaxLines != nil && linesWritten >= *opts.MaxLines {
				break
			}

			var entry *LogEntry
			if opts.LogType == models.LogTypeZtunnel {
				entry = parseZtunnelLine(line, name)
			} else {
				entry = parseLogLine(line, opts.LogType == models.LogTypeProxy || opts.LogType == models.LogTypeWaypoint, engardeParser)
			}

			if entry == nil {
				continue
			}

			if opts.LogType == models.LogTypeZtunnel && !filterMatches(entry.Message, opts.filter) {
				continue
			}

			if opts.LogType == models.LogTypeWaypoint && (opts.filter.app.MatchString("") || !opts.filter.app.MatchString(entry.Message)) {
				continue
			}

			// If we are past the requested time window then stop processing
			if startTime == nil {
				startTime = &entry.OriginalTime
			}

			if isBounded {
				if endTime == nil {
					end := entry.OriginalTime.Add(*opts.Duration)
					endTime = &end
				}

				if entry.OriginalTime.After(*endTime) {
					break
				}
			}

			// Send to client the processed log line

			response, err := json.Marshal(entry)
			if err != nil {
				// Remember that since the HTTP Response body is already being sent,
				// it is not possible to change the response code. So, log the error
				// and terminate early the response.
				log.Errorf("Error when marshalling JSON while streaming pod logs: %s", err.Error())
				return nil
			}

			if firstEntry {
				firstEntry = false
			} else {
				_, writeErr = w.Write([]byte{','})
				if writeErr != nil {
					// Remember that since the HTTP Response body is already being sent,
					// it is not possible to change the response code. So, log the error
					// and terminate early the response.
					log.Errorf("Error when writing log entries separator: %s", writeErr.Error())
					return nil
				}
			}

			_, writeErr = w.Write(response)
			if writeErr != nil {
				log.Errorf("Error when writing a processed log entry while streaming pod logs: %s", writeErr.Error())
				return nil
			}

			linesWritten++
		}
		if readErr == nil && opts.MaxLines != nil && linesWritten >= *opts.MaxLines {
			// End the JSON document, setting the max-lines truncated flag
			_, writeErr = w.Write([]byte("], \"linesTruncated\": true}"))
			if writeErr != nil {
				log.Errorf("Error when writing the outro of the JSON document while streaming pod logs: %s", err.Error())
			}
			break
		} else {
			if i == len(names)-1 {
				// End the JSON document
				_, writeErr = w.Write([]byte("]}"))
				if writeErr != nil {
					log.Errorf("Error when writing the outro of the JSON document while streaming pod logs: %s", err.Error())
				}
			}
		}
	}

	return nil
}

// StreamPodLogs streams pod logs to an HTTP Response given the provided options
// The workload name is used to get the waypoint workloads when opts.LogType is "waypoint"
func (in *WorkloadService) StreamPodLogs(ctx context.Context, cluster, namespace, workload, service, name string, opts *LogOptions, w http.ResponseWriter) error {
	names := []string{}
	if opts.LogType == models.LogTypeZtunnel {
		// First, get ztunnel namespace and containers
		pods := in.cache.GetZtunnelPods(cluster)
		// This is needed for the K8S client
		opts.PodLogOptions.Container = models.IstioProxy
		wkDstPattern := fmt.Sprintf(`dst\.workload=("?%s"?)`, name)
		nsDstPattern := fmt.Sprintf(`dst\.namespace=("?%s"?)`, namespace)
		wkSrcPattern := fmt.Sprintf(`src\.workload=("?%s"?)`, name)
		nsSrcPattern := fmt.Sprintf(`src\.namespace=("?%s"?)`, namespace)
		svcPattern := fmt.Sprintf(`dst\.service=("?%s.%s.?)`, service, namespace)

		// The ztunnel line should include the pod and the namespace
		fs := filterOpts{
			destWk:  *regexp.MustCompile(wkDstPattern),
			destNs:  *regexp.MustCompile(nsDstPattern),
			srcWk:   *regexp.MustCompile(wkSrcPattern),
			srcNs:   *regexp.MustCompile(nsSrcPattern),
			destSvc: *regexp.MustCompile(svcPattern),
		}
		opts.filter = fs
		for _, pod := range pods {
			names = append(names, pod.Name)
		}
		// They should be all in the same ns
		return in.streamParsedLogs(cluster, pods[0].Namespace, names, opts, w)
	}
	if opts.LogType == models.LogTypeWaypoint {
		wk, err := in.GetWorkload(ctx, WorkloadCriteria{Cluster: cluster, Namespace: namespace, WorkloadName: workload, IncludeServices: false})
		if err != nil {
			log.Errorf("Error when getting workload info: %s", err.Error())
		} else {
			if len(wk.WaypointWorkloads) > 0 {
				// Waypoint filter by the app name
				fs := filterOpts{
					app: *regexp.MustCompile(service),
				}
				opts.filter = fs
				waypoint := wk.WaypointWorkloads[0]
				waypointWk, errWaypoint := in.GetWorkload(ctx, WorkloadCriteria{Cluster: waypoint.Cluster, Namespace: waypoint.Namespace, WorkloadName: waypoint.Name, IncludeServices: false})
				if errWaypoint != nil {
					log.Errorf("Error when getting workload info: %s", err.Error())
				} else {
					for _, pod := range waypointWk.Pods {
						names = append(names, pod.Name)
					}
					// This is needed for the K8S client
					opts.PodLogOptions.Container = models.IstioProxy
					return in.streamParsedLogs(cluster, waypoint.Namespace, names, opts, w)
				}
			}
		}
	}
	names = append(names, name)
	return in.streamParsedLogs(cluster, namespace, names, opts, w)
}

// AND filter
func filterMatches(line string, filter filterOpts) bool {
	if (filter.destNs.MatchString(line) && filter.destWk.MatchString(line)) || (filter.srcNs.MatchString(line) && filter.srcWk.MatchString(line) || filter.destSvc.MatchString(line)) {
		return true
	}
	return false
}
