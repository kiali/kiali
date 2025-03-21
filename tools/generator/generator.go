package generator

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kubeinformers "k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	corev1listers "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/log"
)

const (
	// Dense creates a graph with many nodes.
	Dense = "dense"
	// Sparse creates a graph with few nodes.
	Sparse = "sparse"

	maxWorkloadVersions = 3
)

type app struct {
	Box       string
	Cluster   string
	Name      string
	Namespace string
	IsIngress bool
}

// Generator creates graph data based on the options provided.
// It is used for testing a variety of graph layouts, large dense graphs in particular,
// without needing to deploy the actual resources. It is not intended to be used for
// anything other than testing.
type Generator struct {
	// Cluster is the name of the cluster all nodes will live in.
	Cluster string

	// Type of graph to render e.g. Versioned App Graph.
	GraphType string

	// IncludeBoxing determines whether nodes will include boxing or not.
	IncludeBoxing bool

	// NumberOfApps sets how many apps to create.
	NumberOfApps int

	// NumberOfIngress sets how many ingress to create.
	NumberOfIngress int

	// PopulationStrategy determines how many connections from ingress i.e. dense or sparse.
	PopulationStrategy string

	kubeClient      kubernetes.Interface
	namespaceLister corev1listers.NamespaceLister
}

// New create a new Generator. Options can be nil.
func New(opts Options) (*Generator, error) {
	g := Generator{
		Cluster:            "test",
		GraphType:          graph.GraphTypeVersionedApp,
		IncludeBoxing:      true,
		NumberOfApps:       10,
		NumberOfIngress:    1,
		PopulationStrategy: Dense,
	}

	// Kube specific options
	if opts.KubeClient != nil {
		g.kubeClient = opts.KubeClient

		kubeInformerFactory := kubeinformers.NewSharedInformerFactory(g.kubeClient, time.Second*30)
		g.namespaceLister = kubeInformerFactory.Core().V1().Namespaces().Lister()
		namespacesSynced := kubeInformerFactory.Core().V1().Namespaces().Informer().HasSynced

		stopCh := make(<-chan struct{})
		kubeInformerFactory.Start(stopCh)

		if ok := cache.WaitForCacheSync(stopCh, namespacesSynced); !ok {
			log.Fatalf("Failed waiting for caches to sync")
		}
	}

	if opts.Cluster != nil {
		g.Cluster = *opts.Cluster
	}
	if opts.IncludeBoxing != nil {
		g.IncludeBoxing = *opts.IncludeBoxing
	}
	if opts.NumberOfApps != nil {
		g.NumberOfApps = *opts.NumberOfApps
	}
	if opts.NumberOfIngress != nil {
		g.NumberOfIngress = *opts.NumberOfIngress
	}
	if opts.PopulationStrategy != nil {
		g.PopulationStrategy = *opts.PopulationStrategy
	}

	return &g, nil
}

// EnsureNamespaces makes sure a kube namespace exists for the nodes.
// The namespaces need to actually exist in order for the UI to render the graph.
// Does nothing if a kubeclient is not configured.
func (g *Generator) EnsureNamespaces(graphConfig common.Config) error {
	if g.kubeClient != nil {
		log.Info("Ensuring namespaces exist for graph...")
		for _, node := range graphConfig.Elements.Nodes {
			if err := g.ensureNamespace(node.Data.Namespace); err != nil {
				return err
			}
		}
	}
	return nil
}

// Generate creates a graph response object based on the generator's options.
// The generated graph assumes that:
// 1. Workloads send requests to services.
// 2. Services send requests to the workloads in their app.
// 3. Ingress workloads are root nodes.
func (g *Generator) Generate() common.Config {
	nodes := g.generate()
	traffic := graph.NewTrafficMap()
	for _, node := range nodes {
		traffic[node.ID] = node
	}

	// Hard coding some of these for now. In the future, the generator can
	// support multiple graph types.
	opts := graph.ConfigOptions{
		CommonOptions: graph.CommonOptions{
			Duration:  time.Minute * 15,
			GraphType: g.GraphType,
			QueryTime: int64(15),
		},
		BoxBy: strings.Join([]string{graph.BoxByApp, graph.BoxByNamespace}, ","),
	}
	graphConfig := common.NewConfig(traffic, opts)

	if err := g.EnsureNamespaces(graphConfig); err != nil {
		log.Errorf("unable to ensure namespaces exist. Err: %s", err)
	}

	return graphConfig
}

func (g *Generator) strategyLimit() int {
	switch g.PopulationStrategy {
	case Dense:
		return g.NumberOfApps
	case Sparse:
		return g.NumberOfApps / 2
	}

	return -1
}

func (g *Generator) genAppsWithIngress(index int, numApps int) []*graph.Node {
	var nodes []*graph.Node

	// Create ingress workload first.
	ingress := app{
		Cluster:   g.Cluster,
		Name:      fmt.Sprintf("istio-ingressgateway-%d", index),
		Namespace: "istio-system",
		IsIngress: true,
	}
	iNodes := []*graph.Node{g.newWorkloadNode(ingress, "latest")}

	// Then create the rest of them.
	for i := 1; i <= numApps; i++ {
		app := app{
			Cluster: g.Cluster,
			Name:    fmt.Sprintf("app-%d", i),
			// Creates at most a namespace per app.
			// Multiple apps can land in the same namespace.
			// TODO: Provide option to control this.
			Namespace: getRandomNamespace(1, g.NumberOfApps),
		}
		appNodes := g.genApp(app)
		nodes = append(nodes, appNodes...)
	}

	// Add edges from the ingress workload to each of the app's service node.
	// This simulates traffic coming in from ingress and going out to each of
	// the service nodes in the graph.
	iWorkloads := filterByApp(iNodes)
	svcs := filterByService(nodes)

	for _, wk := range iWorkloads {
		for i := 0; i < g.strategyLimit() && i < len(svcs); i++ {
			svc := svcs[i]
			e := wk.AddEdge(svc)
			addFakeEdgeTraffic(e, svc.Service)
		}
	}

	nodes = append(nodes, iNodes...)

	return nodes
}

func (g *Generator) generate() []*graph.Node {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	var nodes []*graph.Node

	appsPerIngress := g.NumberOfApps / g.NumberOfIngress
	for i := 0; i < g.NumberOfIngress; i++ {
		n := g.genAppsWithIngress(i, appsPerIngress)
		nodes = append(nodes, n...)
	}
	// TODO: Random connections to other services

	return nodes
}

func (g *Generator) genApp(app app) []*graph.Node {
	var nodes []*graph.Node

	svc := g.newServiceNode(app)
	nodes = append(nodes, svc)

	// Determine how many workload versions there will be.
	numVersions := rand.Intn(maxWorkloadVersions) + 1 // Start at v1 instead of 0
	for i := 1; i <= numVersions; i++ {
		workload := g.newWorkloadNode(app, fmt.Sprintf("v%d", i))
		nodes = append(nodes, workload)
		e := svc.AddEdge(workload)
		addFakeEdgeTraffic(e, svc.Service)
	}

	return nodes
}

func addFakeEdgeTraffic(e *graph.Edge, destination string) {
	e.Metadata[graph.ProtocolKey] = "http"
	e.Metadata[graph.HTTP.EdgeResponses] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{
				"-": 0.3333999999,
			},
			Hosts: graph.ResponseHosts{
				destination: 0.3333999999,
			},
		},
	}
	e.Metadata[graph.MetadataKey("http")] = 1.00
}

func (g *Generator) newServiceNode(app app) *graph.Node {
	// It is important to leave app name blank here, otherwise this node will be considered a workload.
	s, _ := graph.NewNode(app.Cluster, app.Namespace, app.Name, app.Namespace, "", "", "", g.GraphType)
	return s
}

func (g *Generator) newWorkloadNode(app app, version string) *graph.Node {
	workload := app.Name + "-" + version
	node, _ := graph.NewNode(app.Cluster, app.Namespace, "", app.Namespace, workload, app.Name, version, g.GraphType)
	if app.IsIngress {
		node.Metadata[graph.IsRoot] = true
		node.Metadata[graph.IsIngressGateway] = graph.GatewaysMetadata{node.Workload: []string{"*"}}
		node.Metadata[graph.IsOutside] = true
	}
	return node
}

func (g *Generator) ensureNamespace(name string) error {
	if _, err := g.namespaceLister.Get(name); err != nil {
		if kubeerrors.IsNotFound(err) {
			log.Infof("Namespace: '%s' does not exist. Creating...", name)
			ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: name}}
			_, err = g.kubeClient.CoreV1().Namespaces().Create(context.TODO(), ns, metav1.CreateOptions{})
			if err != nil && !kubeerrors.IsAlreadyExists(err) {
				return err
			}
		} else {
			return err
		}
	}

	return nil
}

func filterByApp(nodes []*graph.Node) []*graph.Node {
	var workloads []*graph.Node
	for i, n := range nodes {
		if n.NodeType == graph.NodeTypeApp {
			workloads = append(workloads, nodes[i])
		}
	}
	return workloads
}

func filterByService(nodes []*graph.Node) []*graph.Node {
	var services []*graph.Node
	for i, n := range nodes {
		if n.NodeType == graph.NodeTypeService {
			services = append(services, nodes[i])
		}
	}
	return services
}

func generateNamespaceName(numNamespace int) string {
	return fmt.Sprintf("n%d", numNamespace)
}

func getRandomNamespace(from, to int) string {
	numNamespace := from + rand.Intn(to)
	return generateNamespaceName(numNamespace)
}
