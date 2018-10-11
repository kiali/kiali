package business

import (
	"sort"
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	osappsv1 "github.com/openshift/api/apps/v1"

	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"time"
)

// Workload deals with fetching istio/kubernetes workloads related content and convert to kiali model
type WorkloadService struct {
	k8s kubernetes.IstioClientInterface
}

// GetWorkloadList is the API handler to fetch the list of workloads in a given namespace.
func (in *WorkloadService) GetWorkloadList(namespace string) (models.WorkloadList, error) {

	workloadList := &models.WorkloadList{
		Namespace: models.Namespace{namespace, time.Time{}},
		Workloads: []models.WorkloadListItem{},
	}
	ws, err := fetchWorkloads(in.k8s, namespace, "")
	if err != nil {
		return *workloadList, err
	}

	for _, w := range ws {
		wItem := &models.WorkloadListItem{}
		wItem.ParseWorkload(w)
		workloadList.Workloads = append(workloadList.Workloads, *wItem)
	}

	return *workloadList, nil
}

// GetWorkload is the API handler to fetch details of a specific workload.
// If includeServices is set true, the Workload will fetch all services related
func (in *WorkloadService) GetWorkload(namespace string, workloadName string, includeServices bool) (*models.Workload, error) {
	workload, err := fetchWorkload(in.k8s, namespace, workloadName)
	if err != nil {
		return nil, err
	}

	if includeServices {
		services, err := in.k8s.GetServices(namespace, workload.Labels)
		if err != nil {
			return nil, err
		}
		workload.SetServices(services)
	}

	return workload, nil
}

func (in *WorkloadService) GetPods(namespace string, labelSelector string) (models.Pods, error) {
	ps, err := in.k8s.GetPods(namespace, labelSelector)
	if err != nil {
		return nil, err
	}
	pods := models.Pods{}
	pods.Parse(ps)
	return pods, nil
}

func fetchWorkloads(k8s kubernetes.IstioClientInterface, namespace string, labelSelector string) (models.Workloads, error) {
	var pods []v1.Pod
	var repcon []v1.ReplicationController
	var dep []v1beta1.Deployment
	var repset []v1beta2.ReplicaSet
	var depcon []osappsv1.DeploymentConfig
	var fulset []v1beta2.StatefulSet
	var jbs []batch_v1.Job
	var conjbs []batch_v1beta1.CronJob

	ws := models.Workloads{}

	wg := sync.WaitGroup{}
	wg.Add(8)
	errChan := make(chan error, 8)

	go func() {
		defer wg.Done()
		var err error
		pods, err = k8s.GetPods(namespace, labelSelector)
		if err != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		dep, err = k8s.GetDeployments(namespace)
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		repset, err = k8s.GetReplicaSets(namespace)
		if err != nil {
			log.Errorf("Error fetching ReplicaSets per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		repcon, err = k8s.GetReplicationControllers(namespace)
		if err != nil {
			log.Errorf("Error fetching GetReplicationControllers per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		if k8s.IsOpenShift() {
			depcon, err = k8s.GetDeploymentConfigs(namespace)
			if err != nil {
				log.Errorf("Error fetching DeploymentConfigs per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		fulset, err = k8s.GetStatefulSets(namespace)
		if err != nil {
			log.Errorf("Error fetching StatefulSets per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		conjbs, err = k8s.GetCronJobs(namespace)
		if err != nil {
			log.Errorf("Error fetching CronJobs per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		jbs, err = k8s.GetJobs(namespace)
		if err != nil {
			log.Errorf("Error fetching Jobs per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return ws, err
	}

	// Key: name of controller; Value: type of controller
	controllers := map[string]string{}

	// Find controllers from pods
	for _, pod := range pods {
		if len(pod.OwnerReferences) != 0 {
			for _, ref := range pod.OwnerReferences {
				if ref.Controller != nil && *ref.Controller {
					if _, exist := controllers[ref.Name]; !exist {
						controllers[ref.Name] = ref.Kind
					} else {
						if controllers[ref.Name] != ref.Kind {
							controllers[ref.Name] = controllerPriority(controllers[ref.Name], ref.Kind)
						}
					}
				}
			}
		} else {
			if _, exist := controllers[pod.Name]; !exist {
				// Pod without controller
				controllers[pod.Name] = "Pod"
			}
		}
	}

	// Resolve ReplicaSets from Deployments
	// Resolve ReplicationControllers from DeploymentConfigs
	// Resolve Jobs from CronJobs
	for cname, ctype := range controllers {
		if ctype == "ReplicaSet" {
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == cname {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repset[iFound].OwnerReferences) > 0 {
				for _, ref := range repset[iFound].OwnerReferences {
					if ref.Controller != nil && *ref.Controller {
						// Delete the child ReplicaSet and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = ref.Kind
						} else {
							if controllers[ref.Name] != ref.Kind {
								controllers[ref.Name] = controllerPriority(controllers[ref.Name], ref.Kind)
							}
						}
						delete(controllers, cname)
					}
				}
			}
		}
		if ctype == "ReplicationController" {
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == cname {
					iFound = i
					found = true
					break
				}
			}
			if found && len(repcon[iFound].OwnerReferences) > 0 {
				for _, ref := range repcon[iFound].OwnerReferences {
					if ref.Controller != nil && *ref.Controller {
						// Delete the child ReplicationController and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = ref.Kind
						} else {
							if controllers[ref.Name] != ref.Kind {
								controllers[ref.Name] = controllerPriority(controllers[ref.Name], ref.Kind)
							}
						}
						delete(controllers, cname)
					}
				}
			}
		}
		if ctype == "Job" {
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == cname {
					iFound = i
					found = true
					break
				}
			}
			if found && len(jbs[iFound].OwnerReferences) > 0 {
				for _, ref := range jbs[iFound].OwnerReferences {
					if ref.Controller != nil && *ref.Controller {
						// Delete the child Job and add the parent controller
						if _, exist := controllers[ref.Name]; !exist {
							controllers[ref.Name] = ref.Kind
						} else {
							if controllers[ref.Name] != ref.Kind {
								controllers[ref.Name] = controllerPriority(controllers[ref.Name], ref.Kind)
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
							delete(controllers, cname)
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
			controllers[d.Name] = "Deployment"
		}
	}
	for _, rs := range repset {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(rs.Spec.Template.Labels))
		}
		if _, exist := controllers[rs.Name]; !exist && len(rs.OwnerReferences) == 0 && selectorCheck {
			controllers[rs.Name] = "ReplicaSet"
		}
	}
	for _, dc := range depcon {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(dc.Spec.Template.Labels))
		}
		if _, exist := controllers[dc.Name]; !exist && selectorCheck {
			controllers[dc.Name] = "DeploymentConfig"
		}
	}
	for _, rc := range repcon {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(rc.Spec.Template.Labels))
		}
		if _, exist := controllers[rc.Name]; !exist && len(rc.OwnerReferences) == 0 && selectorCheck {
			controllers[rc.Name] = "ReplicationController"
		}
	}
	for _, fs := range fulset {
		selectorCheck := true
		if selector != nil {
			selectorCheck = selector.Matches(labels.Set(fs.Spec.Template.Labels))
		}
		if _, exist := controllers[fs.Name]; !exist && selectorCheck {
			controllers[fs.Name] = "StatefulSet"
		}
	}

	// Build workloads from controllers
	var cnames []string
	for k := range controllers {
		cnames = append(cnames, k)
	}
	sort.Strings(cnames)
	for _, cname := range cnames {
		w := &models.Workload{
			Pods:     models.Pods{},
			Services: models.Services{},
		}
		ctype := controllers[cname]
		// Flag to add a controller if it is found
		cnFound := true
		switch ctype {
		case "Deployment":
			found := false
			iFound := -1
			for i, dp := range dep {
				if dp.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(dep[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseDeployment(&dep[iFound])
			} else {
				log.Errorf("Workload %s is not found as Deployment", cname)
				cnFound = false
			}
		case "ReplicaSet":
			found := false
			iFound := -1
			for i, rs := range repset {
				if rs.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseReplicaSet(&repset[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicaSet", cname)
				cnFound = false
			}
		case "ReplicationController":
			found := false
			iFound := -1
			for i, rc := range repcon {
				if rc.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(repcon[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseReplicationController(&repcon[iFound])
			} else {
				log.Errorf("Workload %s is not found as ReplicationController", cname)
				cnFound = false
			}
		case "DeploymentConfig":
			found := false
			iFound := -1
			for i, dc := range depcon {
				if dc.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(depcon[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseDeploymentConfig(&depcon[iFound])
			} else {
				log.Errorf("Workload %s is not found as DeploymentConfig", cname)
				cnFound = false
			}
		case "StatefulSet":
			found := false
			iFound := -1
			for i, fs := range fulset {
				if fs.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(fulset[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseStatefulSet(&fulset[iFound])
			} else {
				log.Errorf("Workload %s is not found as StatefulSet", cname)
				cnFound = false
			}
		case "Pod":
			found := false
			iFound := -1
			for i, pod := range pods {
				if pod.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				w.SetPods([]v1.Pod{pods[iFound]})
				w.ParsePod(&pods[iFound])
			} else {
				log.Errorf("Workload %s is not found as Pod", cname)
				cnFound = false
			}
		case "Job":
			found := false
			iFound := -1
			for i, jb := range jbs {
				if jb.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(jbs[iFound].Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseJob(&jbs[iFound])
			} else {
				log.Errorf("Workload %s is not found as Job", cname)
				cnFound = false
			}
		case "CronJob":
			found := false
			iFound := -1
			for i, cjb := range conjbs {
				if cjb.Name == cname {
					found = true
					iFound = i
					break
				}
			}
			if found {
				selector := labels.Set(conjbs[iFound].Spec.JobTemplate.Spec.Template.Labels).AsSelector()
				w.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
				w.ParseCronJob(&conjbs[iFound])
			} else {
				log.Warningf("Workload %s is not found as CronJob (CronJob could be deleted but children are still in the namespace)", cname)
				cnFound = false
			}
		default:
			cPods := kubernetes.FilterPodsForController(cname, ctype, pods)
			w.SetPods(cPods)
			w.ParsePods(cname, ctype, cPods)
		}
		if cnFound {
			ws = append(ws, w)
		}
	}
	return ws, nil
}

func fetchWorkload(k8s kubernetes.IstioClientInterface, namespace string, workloadName string) (*models.Workload, error) {
	wl := &models.Workload{
		Pods:     models.Pods{},
		Services: models.Services{},
	}

	var pods []v1.Pod
	var dp *v1beta1.Deployment
	var rs *v1beta2.ReplicaSet
	var rc *v1.ReplicationController
	var dc *osappsv1.DeploymentConfig
	var sf *v1beta2.StatefulSet
	var cj *batch_v1beta1.CronJob
	var jb *batch_v1.Job

	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 1)

	go func() {
		defer wg.Done()
		var err error
		pods, err = k8s.GetPods(namespace, "")
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		dp, err = k8s.GetDeployment(namespace, workloadName)
		if err != nil {
			dp = nil
			rs, err = k8s.GetReplicaSet(namespace, workloadName)
			if err != nil {
				rs = nil
				rc, err = k8s.GetReplicationController(namespace, workloadName)
				if err != nil {
					rc = nil
					sf, err = k8s.GetStatefulSet(namespace, workloadName)
					if err != nil {
						sf = nil
						cj, err = k8s.GetCronJob(namespace, workloadName)
						if err != nil {
							cj = nil
							jb, err = k8s.GetJob(namespace, workloadName)
							if err != nil {
								jb = nil
								if k8s.IsOpenShift() {
									dc, err = k8s.GetDeploymentConfig(namespace, workloadName)
									if err != nil {
										dc = nil
									}
								}
							}
						}
					}
				}
			}
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return wl, err
	}

	if dp != nil {
		selector := labels.Set(dp.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseDeployment(dp)
		return wl, nil
	}

	if rs != nil {
		selector := labels.Set(rs.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseReplicaSet(rs)
		return wl, nil
	}

	if rc != nil {
		selector := labels.Set(rc.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseReplicationController(rc)
		return wl, nil
	}

	if sf != nil {
		selector := labels.Set(sf.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseStatefulSet(sf)
		return wl, nil
	}

	if cj != nil {
		selector := labels.Set(cj.Spec.JobTemplate.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseCronJob(cj)
		return wl, nil
	}

	if jb != nil {
		selector := labels.Set(jb.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseJob(jb)
		return wl, nil
	}

	if dc != nil {
		selector := labels.Set(dc.Spec.Template.Labels).AsSelector()
		wl.SetPods(kubernetes.FilterPodsForSelector(selector, pods))
		wl.ParseDeploymentConfig(dc)
		return wl, nil
	}

	// Workload is a controller not listed or a pod
	ctype := ""
	found := false
	iFound := -1
	for i, pod := range pods {
		if pod.Name == workloadName {
			ctype = "Pod"
			found = true
			iFound = i
			break
		}
		for _, ref := range pod.OwnerReferences {
			if ref.Controller != nil && *ref.Controller && ref.Name == workloadName {
				ctype = ref.Kind
				break
			}
		}
		if ctype != "" {
			break
		}
	}

	if found && ctype == "Pod" {
		wl.ParsePod(&pods[iFound])
		wl.SetPods([]v1.Pod{pods[iFound]})
		return wl, nil
	}

	if ctype != "" {
		cPods := kubernetes.FilterPodsForController(workloadName, ctype, pods)
		wl.ParsePods(workloadName, ctype, cPods)
		wl.SetPods(cPods)
		return wl, nil
	} else {
		// Workload Not found
		return wl, kubernetes.NewNotFound("kiali", "workload", workloadName)
	}

	return wl, nil
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
		log.Errorf("This controller %s is assigned in a Pod and it's not properly managed", type1)
	}
	w2, e2 := controllerOrder[type2]
	if !e2 {
		log.Errorf("This controller %s is assigned in a Pod and it's not properly managed", type2)
	}
	if w1 >= w2 {
		return type1
	} else {
		return type2
	}
}
