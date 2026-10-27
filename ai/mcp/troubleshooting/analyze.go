package troubleshooting

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/kiali/kiali/ai/mcp/list_or_get_resources"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config_read"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// resourceTypesChecked are listed inside an unhealthy namespace before the dashboard is returned.
var resourceTypesChecked = []string{"service", "workload", "app", "argoapp"}

// troubleshootingLookupParallelism bounds concurrent Kiali reads during one troubleshooting scan.
// Istio object gets and data-plane resource lists (services, workloads, apps, Argo apps) share this limit.
const troubleshootingLookupParallelism = 8

// namespaceFindings keeps the generic namespace sub-problem only when no critical
// cause was found. Warnings are always appended.
func namespaceFindings(namespaceSub SubProblem, critical, warnings []SubProblem) []SubProblem {
	subs := make([]SubProblem, 0, 1+len(critical)+len(warnings))
	if len(critical) == 0 {
		subs = append(subs, namespaceSub)
	}
	subs = append(subs, critical...)
	subs = append(subs, warnings...)
	return subs
}

// unhealthyNamespace is one data-plane namespace whose services, workloads, apps, and Argo apps are listed together.
type unhealthyNamespace struct {
	Cluster string
	Name    string
}

// analyzeUnhealthyNamespaces lists unhealthy resources for each namespace in parallel.
// Results stay in the same order as namespaces. Resource types inside a namespace are also fetched together.
// sem is the shared lookup limit; nil starts a limit used only by this scan.
func analyzeUnhealthyNamespaces(ki *mcputil.KialiInterface, namespaces []unhealthyNamespace, sem chan struct{}) [][]SubProblem {
	results := make([][]SubProblem, len(namespaces))
	if ki == nil || len(namespaces) == 0 {
		return results
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}
	var wg sync.WaitGroup
	for i, ns := range namespaces {
		wg.Add(1)
		go func(i int, ns unhealthyNamespace) {
			defer wg.Done()
			results[i] = unhealthyResourcesInNamespace(ki, ns.Cluster, ns.Name, sem)
		}(i, ns)
	}
	wg.Wait()
	return results
}

// istioObjectsIssue lists Istio objects that fail validation, were not validated, or are valid but still have checks.
// namespace limits the list to that namespace; an empty namespace scans the cluster.
func istioObjectsIssue(ki *mcputil.KialiInterface, cluster, namespace string, sem chan struct{}) *Issue {
	critical, warnings, _ := istioFindings(ki, cluster, namespace, nil, sem)
	subs := append(critical, warnings...)
	if len(subs) == 0 {
		return nil
	}
	problem := "Istio objects are invalid, not validated, or have validation checks"
	if namespace != "" {
		problem = fmt.Sprintf("Istio objects in namespace %q are invalid, not validated, or have validation checks", namespace)
	}
	return &Issue{
		ID:          idIstioConfig,
		Category:    CategoryIstioObjects,
		Problem:     problem,
		Description: "An object that is not valid is critical. An object that is valid but still has checks is a warning, as is an object Kiali did not validate. A valid object with no checks is not reported.",
		SubProblems: subs,
	}
}

func unhealthyResourcesInNamespace(ki *mcputil.KialiInterface, cluster, namespace string, sem chan struct{}) []SubProblem {
	if ki == nil || namespace == "" {
		return nil
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}
	grouped := make([][]SubProblem, len(resourceTypesChecked))
	var wg sync.WaitGroup
	for i, resourceType := range resourceTypesChecked {
		wg.Add(1)
		go func(i int, resourceType string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			grouped[i] = listUnhealthyResources(ki, cluster, namespace, resourceType)
		}(i, resourceType)
	}
	wg.Wait()

	var subs []SubProblem
	for _, group := range grouped {
		subs = append(subs, group...)
	}
	return subs
}

func listUnhealthyResources(ki *mcputil.KialiInterface, cluster, namespace, resourceType string) []SubProblem {
	args := map[string]interface{}{
		"namespace":    namespace,
		"resourceType": resourceType,
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	result, code := list_or_get_resources.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: list_or_get_resources %s in namespace %s returned %d: %v", resourceType, namespace, code, result)
		return nil
	}
	return subProblemsFromResourceList(cluster, namespace, resourceType, result)
}

type namedHealth struct {
	health string
	kind   string
	name   string
}

func subProblemsFromResourceList(cluster, namespace, resourceType string, result interface{}) []SubProblem {
	var found []namedHealth
	switch typed := result.(type) {
	case map[string][]list_or_get_resources.ResourceListItem:
		for _, items := range typed {
			for _, item := range items {
				found = append(found, namedHealth{health: item.Health, kind: item.Type, name: item.Name})
			}
		}
	case list_or_get_resources.AppListResponse:
		for _, app := range typed.Applications {
			found = append(found, namedHealth{health: app.Health, name: app.Name})
		}
	case list_or_get_resources.ArgoCDAppListResponse:
		for _, app := range typed.Applications {
			found = append(found, namedHealth{health: app.Health, name: app.Name})
		}
	default:
		return nil
	}
	sort.Slice(found, func(i, j int) bool { return found[i].name < found[j].name })

	var subs []SubProblem
	for _, item := range found {
		if item.name == "" || isHealthyStatus(item.health) {
			continue
		}
		label := resourceLabel(resourceType, item.kind)
		target := fmt.Sprintf("%s: %s/%s", label, namespace, item.name)
		subs = append(subs, newSubProblem(
			dataPlaneResourceID(cluster, namespace, resourceType, item.name),
			target,
			fmt.Sprintf("health is %s", item.health),
			fmt.Sprintf("%s %q in namespace %q is not healthy.", label, item.name, namespace),
		))
	}
	return subs
}

func resourceLabel(resourceType, kind string) string {
	switch resourceType {
	case "service":
		return "Service"
	case "workload":
		if kind != "" {
			return "Workload (" + kind + ")"
		}
		return "Workload"
	case "app":
		return "App"
	case "argoapp":
		return "ArgoCD Application"
	default:
		return resourceType
	}
}

func istioFindings(ki *mcputil.KialiInterface, cluster, namespace string, skip map[string]bool, sem chan struct{}) (critical, warnings []SubProblem, reported map[string]bool) {
	listed, ok := listIstioConfig(ki, cluster, namespace)
	if !ok {
		return nil, nil, nil
	}
	return istioSubProblems(listed.Namespaces, skip, func(ns, group, version, kind, name string) *models.IstioValidation {
		return getIstioValidation(ki, cluster, ns, group, version, kind, name)
	}, sem)
}

func istioObjectKey(namespace, kind, name string) string {
	return namespace + "/" + kind + "/" + name
}

func istioObjectRef(target istioLookupTarget) *IstioObjectRef {
	if target.Group == "" || target.Kind == "" || target.Name == "" || target.Namespace == "" || target.Version == "" {
		return nil
	}
	return &IstioObjectRef{
		Group:     target.Group,
		Kind:      target.Kind,
		Name:      target.Name,
		Namespace: target.Namespace,
		Version:   target.Version,
	}
}

// istioLookupTarget is one object whose validation is loaded with manage_istio_config_read get.
// ListedValid is true when the list put the object in valid. Kiali keeps valid true when the only checks are warnings.
type istioLookupTarget struct {
	Group       string
	Kind        string
	ListedValid bool
	Name        string
	Namespace   string
	Version     string
}

type istioWorkItem struct {
	notValidated bool
	target       istioLookupTarget
}

func istioSubProblems(namespaces map[string]map[string]manage_istio_config.KindValidationResult, skip map[string]bool, lookup func(namespace, group, version, kind, name string) *models.IstioValidation, sem chan struct{}) (critical, warnings []SubProblem, reported map[string]bool) {
	reported = map[string]bool{}
	work := istioWorkItems(namespaces, skip)
	validations := fetchIstioValidations(work, lookup, sem)

	for _, item := range work {
		if item.notValidated {
			sub := istioNotValidatedSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, istioObjectID(item.target.Namespace, item.target.Kind, item.target.Name))
			sub.IstioObject = istioObjectRef(item.target)
			attachIstioAnalyzeAction(&sub)
			warnings = append(warnings, sub)
			reported[istioObjectKey(item.target.Namespace, item.target.Kind, item.target.Name)] = true
			continue
		}
		key := istioObjectKey(item.target.Namespace, item.target.Kind, item.target.Name)
		validation := validations[key]
		if item.target.ListedValid {
			checks := validationChecks(item.target.Namespace, item.target.Kind, item.target.Name, validation)
			if len(checks) == 0 {
				continue
			}
			sub := validIstioObjectSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, checks)
			sub.IstioObject = istioObjectRef(item.target)
			attachIstioAnalyzeAction(&sub)
			warnings = append(warnings, sub)
			reported[key] = true
			continue
		}
		// The list marks the object invalid, so the subproblem is critical even when every check is a warning.
		sub := istioObjectSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, validation)
		sub.IstioObject = istioObjectRef(item.target)
		attachIstioAnalyzeAction(&sub)
		critical = append(critical, sub)
		reported[key] = true
	}
	return critical, warnings, reported
}

func istioWorkItems(namespaces map[string]map[string]manage_istio_config.KindValidationResult, skip map[string]bool) []istioWorkItem {
	nsNames := make([]string, 0, len(namespaces))
	for ns := range namespaces {
		nsNames = append(nsNames, ns)
	}
	sort.Strings(nsNames)

	var work []istioWorkItem
	for _, ns := range nsNames {
		kinds := namespaces[ns]
		gvkKeys := make([]string, 0, len(kinds))
		for key := range kinds {
			gvkKeys = append(gvkKeys, key)
		}
		sort.Strings(gvkKeys)
		for _, key := range gvkKeys {
			group, version, kind, ok := parseGVKKey(key)
			if !ok {
				continue
			}
			result := kinds[key]
			for _, name := range sortedNames(result.NotValidated) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{
					notValidated: true,
					target:       istioLookupTarget{Group: group, Kind: kind, Name: name, Namespace: ns, Version: version},
				})
			}
			for _, name := range sortedNames(result.Invalid) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{target: istioLookupTarget{
					Group: group, Kind: kind, Name: name, Namespace: ns, Version: version,
				}})
			}
			for _, name := range sortedNames(result.Valid) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{target: istioLookupTarget{
					Group: group, Kind: kind, ListedValid: true, Name: name, Namespace: ns, Version: version,
				}})
			}
		}
	}
	return work
}

func fetchIstioValidations(work []istioWorkItem, lookup func(namespace, group, version, kind, name string) *models.IstioValidation, sem chan struct{}) map[string]*models.IstioValidation {
	found := map[string]*models.IstioValidation{}
	if lookup == nil {
		return found
	}
	var targets []istioLookupTarget
	for _, item := range work {
		if item.notValidated {
			continue
		}
		targets = append(targets, item.target)
	}
	if len(targets) == 0 {
		return found
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, target := range targets {
		wg.Add(1)
		go func(target istioLookupTarget) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			validation := lookup(target.Namespace, target.Group, target.Version, target.Kind, target.Name)
			mu.Lock()
			found[istioObjectKey(target.Namespace, target.Kind, target.Name)] = validation
			mu.Unlock()
		}(target)
	}
	wg.Wait()
	return found
}

func istioObjectSubProblem(namespace, kind, name string, validation *models.IstioValidation) SubProblem {
	target := fmt.Sprintf("%s: %s/%s", kind, namespace, name)
	return SubProblem{
		Checks:   validationChecks(namespace, kind, name, validation),
		ID:       istioObjectID(namespace, kind, name),
		Impact:   fmt.Sprintf("%s %q in namespace %q fails validation.", kind, name, namespace),
		Issue:    fmt.Sprintf("%s %q fails validation", kind, name),
		Severity: SeverityCritical,
		SuggestedActions: []SuggestedAction{
			{
				Type:        ActionTypeAdvice,
				Description: fmt.Sprintf("Inspect %s %s", kind, name),
				Command:     fmt.Sprintf("kubectl get %s %s -n %s -o yaml", strings.ToLower(kind), name, namespace),
			},
		},
		Target: target,
	}
}

func validIstioObjectSubProblem(namespace, kind, name string, checks []ValidationCheck) SubProblem {
	sub := istioObjectSubProblem(namespace, kind, name, nil)
	sub.Checks = checks
	sub.Impact = fmt.Sprintf("%s %q in namespace %q is valid but has warning validation checks.", kind, name, namespace)
	sub.Issue = fmt.Sprintf("%s %q has validation checks", kind, name)
	sub.Severity = SeverityWarning
	return sub
}

func validationChecks(namespace, kind, name string, validation *models.IstioValidation) []ValidationCheck {
	if validation == nil {
		return nil
	}
	checks := make([]ValidationCheck, 0, len(validation.Checks))
	for _, check := range validation.Checks {
		if check == nil || check.Code == "" {
			continue
		}
		checks = append(checks, ValidationCheck{
			Code:            check.Code,
			Message:         check.Message,
			Path:            check.Path,
			Severity:        checkDisplaySeverity(check.Severity),
			SuggestedPrompt: checkPrompt(namespace, kind, name, check),
		})
	}
	return checks
}

func checkDisplaySeverity(level models.SeverityLevel) string {
	switch strings.ToLower(string(level)) {
	case string(models.ErrorSeverity), SeverityCritical:
		return SeverityCritical
	default:
		return SeverityWarning
	}
}

func checkPrompt(namespace, kind, name string, check *models.IstioCheck) string {
	if check.Path != "" {
		return fmt.Sprintf("Analyze why %s %s/%s fails check %s at %s: %s. What change fixes it?", kind, namespace, name, check.Code, check.Path, check.Message)
	}
	return fmt.Sprintf("Analyze why %s %s/%s fails check %s: %s. What change fixes it?", kind, namespace, name, check.Code, check.Message)
}

func istioNotValidatedSubProblem(namespace, kind, name, id string) SubProblem {
	target := fmt.Sprintf("%s: %s/%s", kind, namespace, name)
	return SubProblem{
		ID:       id,
		Impact:   fmt.Sprintf("%s %q in namespace %q was not validated.", kind, name, namespace),
		Issue:    "validation is not available",
		Severity: SeverityWarning,
		SuggestedActions: []SuggestedAction{
			{
				Type:        ActionTypeAdvice,
				Description: fmt.Sprintf("Inspect %s %s", kind, name),
				Command:     fmt.Sprintf("kubectl get %s %s -n %s -o yaml", strings.ToLower(kind), name, namespace),
			},
		},
		SuggestedPrompt: fmt.Sprintf("Analyze %s %s/%s. Kiali did not validate this object. Is the configuration safe, and what should be checked?", kind, namespace, name),
		Target:          target,
	}
}

// attachIstioAnalyzeAction asks the troubleshooter to fetch this object's YAML.
// The prompt carries the object path and the manage_istio_config_read get parameters.
func attachIstioAnalyzeAction(sub *SubProblem) {
	if sub == nil || sub.IstioObject == nil {
		return
	}
	obj := sub.IstioObject
	action := SuggestedAction{
		Description: fmt.Sprintf("Analyze the YAML of %s %s", obj.Kind, obj.Name),
		Prompt:      istioAnalyzePrompt(sub),
		Type:        ActionTypeAnalyze,
	}
	sub.SuggestedActions = append([]SuggestedAction{action}, sub.SuggestedActions...)
}

func istioObjectPath(obj *IstioObjectRef) string {
	return fmt.Sprintf("istio/%s/%s/%s/%s", obj.Group, obj.Version, obj.Kind, obj.Name)
}

func istioAnalyzePrompt(sub *SubProblem) string {
	obj := sub.IstioObject
	var b strings.Builder
	fmt.Fprintf(&b, "Analyze the YAML of Istio object %s in namespace %s. ", istioObjectPath(obj), obj.Namespace)
	fmt.Fprintf(&b, "Fetch it with the manage_istio_config_read tool, action get, using namespace=%q, group=%q, version=%q, kind=%q, object=%q. ", obj.Namespace, obj.Group, obj.Version, obj.Kind, obj.Name)
	if len(sub.Checks) == 0 {
		b.WriteString("Kiali did not report validation checks. Inspect the YAML and say whether the configuration is safe.")
		return b.String()
	}
	b.WriteString("Kiali reported these validation checks:\n")
	for _, check := range sub.Checks {
		if check.Path != "" {
			fmt.Fprintf(&b, "- [%s] %s at %s: %s\n", check.Code, check.Severity, check.Path, check.Message)
			continue
		}
		fmt.Fprintf(&b, "- [%s] %s: %s\n", check.Code, check.Severity, check.Message)
	}
	b.WriteString("Explain the root cause from the YAML and the minimal change that fixes the checks.")
	return b.String()
}

func listIstioConfig(ki *mcputil.KialiInterface, cluster, namespace string) (manage_istio_config.IstioListResult, bool) {
	if ki == nil {
		return manage_istio_config.IstioListResult{}, false
	}
	args := map[string]interface{}{"action": "list"}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	if namespace != "" {
		args["namespace"] = namespace
	}
	result, code := manage_istio_config_read.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: manage_istio_config_read list namespace %q returned %d: %v", namespace, code, result)
		return manage_istio_config.IstioListResult{}, false
	}
	switch typed := result.(type) {
	case manage_istio_config.IstioListResult:
		return typed, true
	case *manage_istio_config.IstioListResult:
		if typed != nil {
			return *typed, true
		}
	default:
		log.Debugf("troubleshooting: manage_istio_config_read list namespace %q returned %T", namespace, result)
	}
	return manage_istio_config.IstioListResult{}, false
}

func getIstioValidation(ki *mcputil.KialiInterface, cluster, namespace, group, version, kind, name string) *models.IstioValidation {
	if ki == nil {
		return nil
	}
	args := map[string]interface{}{
		"action":    "get",
		"namespace": namespace,
		"group":     group,
		"version":   version,
		"kind":      kind,
		"object":    name,
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	result, code := manage_istio_config_read.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: manage_istio_config_read get %s/%s returned %d: %v", namespace, name, code, result)
		return nil
	}
	switch typed := result.(type) {
	case models.IstioConfigDetails:
		return typed.IstioValidation
	case *models.IstioConfigDetails:
		if typed != nil {
			return typed.IstioValidation
		}
	default:
		log.Debugf("troubleshooting: manage_istio_config_read get %s/%s returned %T", namespace, name, result)
	}
	return nil
}

func parseGVKKey(key string) (group, version, kind string, ok bool) {
	parts := strings.Split(key, "/")
	if len(parts) < 3 {
		return "", "", "", false
	}
	kind = parts[len(parts)-1]
	version = parts[len(parts)-2]
	group = strings.Join(parts[:len(parts)-2], "/")
	if group == "" || version == "" || kind == "" {
		return "", "", "", false
	}
	return group, version, kind, true
}

func sortedNames(names []string) []string {
	out := append([]string(nil), names...)
	sort.Strings(out)
	return out
}
