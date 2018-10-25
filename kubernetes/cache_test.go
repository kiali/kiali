package kubernetes

import (
	"github.com/stretchr/testify/assert"
	"strconv"
	"testing"

	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"
)

func TestCacheGet(t *testing.T) {
	assert := assert.New(t)

	clientset := fake.NewSimpleClientset(fakeRuntimeObjects()...)
	stopCh := make(chan struct{})
	c := newCacheController(clientset, 0, stopCh)
	defer c.StopControlChannel()
	go c.Run(stopCh)

	if !cache.WaitForCacheSync(stopCh, c.HasSynced) {
		t.Fatal("Failed to sync")
	}
	namespaces := []string{"ns1", "ns2", "ns3"}
	objsPerNs := 3
	for _, namespace := range namespaces {
		pods, existPods := c.GetPods(namespace)
		assert.True(existPods)
		assert.Equal(objsPerNs, len(pods))

		rc, existRc := c.GetReplicationControllers(namespace)
		assert.True(existRc)
		assert.Equal(objsPerNs, len(rc))

		deps, existDeps := c.GetDeployments(namespace)
		assert.True(existDeps)
		assert.Equal(objsPerNs, len(deps))

		rs, existRs := c.GetReplicaSets(namespace)
		assert.True(existRs)
		assert.Equal(objsPerNs, len(rs))

		ss, existSs := c.GetStatefulSets(namespace)
		assert.True(existSs)
		assert.Equal(objsPerNs, len(ss))

		jobs, existJobs := c.GetJobs(namespace)
		assert.True(existJobs)
		assert.Equal(objsPerNs, len(jobs))

		cronjobs, existCronjobs := c.GetCronJobs(namespace)
		assert.True(existCronjobs)
		assert.Equal(objsPerNs, len(cronjobs))

		services, existServices := c.GetServices(namespace)
		assert.True(existServices)
		assert.Equal(objsPerNs, len(services))
	}

	dep, existDep := c.GetDeployment("ns3", "dep2")
	assert.True(existDep)
	assert.Equal("ns3", dep.Namespace)
	assert.Equal("dep2", dep.Name)

	ss, existSs := c.GetStatefulSet("ns3", "ss2")
	assert.True(existSs)
	assert.Equal("ns3", ss.Namespace)
	assert.Equal("ss2", ss.Name)

	svc, existSvc := c.GetService("ns3", "service2")
	assert.True(existSvc)
	assert.Equal("ns3", svc.Namespace)
	assert.Equal("service2", svc.Name)

	ep, existEp := c.GetEndpoints("ns3", "endpoints2")
	assert.True(existEp)
	assert.Equal("ns3", ep.Namespace)
	assert.Equal("endpoints2", ep.Name)
}

func fakeRuntimeObjects() []runtime.Object {
	namespaces := []string{"ns1", "ns2", "ns3"}
	num := 3
	objects := make([]runtime.Object, 0)

	for _, ns := range namespaces {
		for i := 0; i < num; i++ {
			pod := &v1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "pod" + strconv.Itoa(i),
				},
			}
			objects = append(objects, pod)

			rc := &v1.ReplicationController{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "rc" + strconv.Itoa(i),
				},
			}
			objects = append(objects, rc)

			dep := &v1beta1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "dep" + strconv.Itoa(i),
				},
			}
			objects = append(objects, dep)

			rs := &v1beta2.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "rs" + strconv.Itoa(i),
				},
			}
			objects = append(objects, rs)

			ss := &v1beta2.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "ss" + strconv.Itoa(i),
				},
			}
			objects = append(objects, ss)

			job := &batch_v1.Job{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "job" + strconv.Itoa(i),
				},
			}
			objects = append(objects, job)

			cronjob := &batch_v1beta1.CronJob{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "cronjob" + strconv.Itoa(i),
				},
			}
			objects = append(objects, cronjob)

			service := &v1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "service" + strconv.Itoa(i),
				},
			}
			objects = append(objects, service)

			endpoints := &v1.Endpoints{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: ns,
					Name:      "endpoints" + strconv.Itoa(i),
				},
			}
			objects = append(objects, endpoints)
		}
	}
	return objects
}
