package kubernetes

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestCacheGet(t *testing.T) {
	assert := assert.New(t)

	clientset := fake.NewSimpleClientset(fakeRuntimeObjects()...)
	c := newCacheController(clientset, 0)
	defer c.Stop()
	c.Start()
	if !c.WaitForSync() {
		t.Fatal("Failed to sync")
	}
	namespaces := []string{"ns1", "ns2", "ns3"}
	objsPerNs := 3
	for _, namespace := range namespaces {
		pods, errPods := c.GetPods(namespace)
		assert.Nil(errPods)
		assert.Equal(objsPerNs, len(pods))

		rc, errRc := c.GetReplicationControllers(namespace)
		assert.Nil(errRc)
		assert.Equal(objsPerNs, len(rc))

		deps, errDeps := c.GetDeployments(namespace)
		assert.Nil(errDeps)
		assert.Equal(objsPerNs, len(deps))

		rs, errRs := c.GetReplicaSets(namespace)
		assert.Nil(errRs)
		assert.Equal(objsPerNs, len(rs))

		ss, errSs := c.GetStatefulSets(namespace)
		assert.Nil(errSs)
		assert.Equal(objsPerNs, len(ss))

		jobs, errJobs := c.GetJobs(namespace)
		assert.Nil(errJobs)
		assert.Equal(objsPerNs, len(jobs))

		cronjobs, errCronjobs := c.GetCronJobs(namespace)
		assert.Nil(errCronjobs)
		assert.Equal(objsPerNs, len(cronjobs))

		services, errServices := c.GetServices(namespace)
		assert.Nil(errServices)
		assert.Equal(objsPerNs, len(services))
	}

	dep, errDep := c.GetDeployment("ns3", "dep2")
	assert.Nil(errDep)
	assert.Equal("ns3", dep.Namespace)
	assert.Equal("dep2", dep.Name)

	ss, errSs := c.GetStatefulSet("ns3", "ss2")
	assert.Nil(errSs)
	assert.Equal("ns3", ss.Namespace)
	assert.Equal("ss2", ss.Name)

	svc, errSvc := c.GetService("ns3", "service2")
	assert.Nil(errSvc)
	assert.Equal("ns3", svc.Namespace)
	assert.Equal("service2", svc.Name)

	ep, errEp := c.GetEndpoints("ns3", "endpoints2")
	assert.Nil(errEp)
	assert.Equal("ns3", ep.Namespace)
	assert.Equal("endpoints2", ep.Name)
}

func fakeRuntimeObjects() []runtime.Object {
	namespaces := []string{"ns1", "ns2", "ns3"}
	num := 3
	objects := make([]runtime.Object, 0)

	for _, ns := range namespaces {
		for i := 0; i < num; i++ {
			pod := &core_v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "pod" + strconv.Itoa(i),
				},
			}
			objects = append(objects, pod)

			rc := &core_v1.ReplicationController{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "rc" + strconv.Itoa(i),
				},
			}
			objects = append(objects, rc)

			dep := &apps_v1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "dep" + strconv.Itoa(i),
				},
			}
			objects = append(objects, dep)

			rs := &apps_v1.ReplicaSet{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "rs" + strconv.Itoa(i),
				},
			}
			objects = append(objects, rs)

			ss := &apps_v1.StatefulSet{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "ss" + strconv.Itoa(i),
				},
			}
			objects = append(objects, ss)

			job := &batch_v1.Job{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "job" + strconv.Itoa(i),
				},
			}
			objects = append(objects, job)

			cronjob := &batch_v1beta1.CronJob{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "cronjob" + strconv.Itoa(i),
				},
			}
			objects = append(objects, cronjob)

			service := &core_v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "service" + strconv.Itoa(i),
				},
			}
			objects = append(objects, service)

			endpoints := &core_v1.Endpoints{
				ObjectMeta: meta_v1.ObjectMeta{
					Namespace: ns,
					Name:      "endpoints" + strconv.Itoa(i),
				},
			}
			objects = append(objects, endpoints)
		}
	}
	return objects
}
