package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tools/cmd"
	"github.com/kiali/kiali/tools/generator"
)

var homeDir, _ = os.UserHomeDir()

// Generate flags
var (
	boxFlag          bool
	clusterFlag      string
	numAppsFlag      int
	numIngressesFlag int
	popStratFlag     generator.PopStratValue = generator.Sparse
)

// Proxy specific flags
var (
	certFileFlag     string
	dataDirFlag      string
	httpsFlag        bool
	keyFileFlag      string
	runGeneratorFlag bool
)

func init() {
	// Proxy specific flags
	flag.StringVar(&certFileFlag, "cert-file", filepath.Join(homeDir, ".minikube/ca.crt"), "path to cert file for https")
	flag.StringVar(&dataDirFlag, "data-dir", "", "path to dir where json graph data is.")
	flag.BoolVar(&httpsFlag, "https", false, "use https. Uses minikube certs by default")
	flag.StringVar(&keyFileFlag, "key-file", filepath.Join(homeDir, ".minikube/ca.key"), "path to key file for https")
	flag.BoolVar(&runGeneratorFlag, "run-generator", false, "If enabled, the proxy runs the generator to generate a new graph.")

	// Generate flags
	flag.BoolVar(&boxFlag, "box", false, "adds boxing to the graph")
	flag.StringVar(&clusterFlag, "cluster", "test", "nodes' cluster name")
	flag.IntVar(&numAppsFlag, "apps", 5, "number of apps to create")
	flag.IntVar(&numIngressesFlag, "ingresses", 1, "number of ingresses to create")
	flag.Var(&popStratFlag, "population-strategy", "whether the graph should have many or few connections")
}

func loadGraphFromFile(filename string) (*common.Config, error) {
	contents, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	graphConfig := &common.Config{}
	err = json.Unmarshal(contents, graphConfig)
	if err != nil {
		return nil, err
	}

	return graphConfig, nil
}

type graphProxy struct {
	httpProxy *httputil.ReverseProxy
	generator *generator.Generator
	graph     *common.Config
}

func (p graphProxy) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	if req.URL.Path == "/api/namespaces/graph" {
		log.Debug("Serving mock graph data...")
		content, err := json.Marshal(p.graph)
		if err != nil {
			log.Errorf("Unable to marshal graph to JSON. Err: %s", err)
			rw.WriteHeader(500)
			return
		}

		_, err = rw.Write(content)
		if err != nil {
			log.Errorf("Unable to write content. Err: %s", err)
			rw.WriteHeader(500)
		}

		return
	}

	p.httpProxy.ServeHTTP(rw, req)
}

func exitWithUsage(msg string) {
	if !strings.HasSuffix(msg, "\n\n") {
		msg = msg + "\n"
	}
	fmt.Fprint(flag.CommandLine.Output(), msg)
	flag.Usage()
	os.Exit(1)
}

func extractPosArgFromArgs() (string, []string) {
	args := os.Args[1:]
	for i, arg := range args {
		if !strings.HasPrefix(arg, "-") && !strings.HasPrefix(arg, "--") {
			return arg, append(args[:i], args[i+1:]...)
		}
	}
	return "", args
}

func main() {
	cmd.ConfigureKialiLogger()

	flag.Usage = cmd.Usage("proxy", "<kiali-url>")
	if len(os.Args) < 2 {
		exitWithUsage("Error: Not enough arguments\n\n")
	}

	// The default flag.Parse() does not handle posargs interspersed with flags well
	// so extract out the url pos arg first before passing the args to Parse.
	urlArg, args := extractPosArgFromArgs()
	_ = flag.CommandLine.Parse(args)
	// Parse first in case '-help' is passed.
	if urlArg == "" {
		exitWithUsage("Error: 'kiali-url' is a required positional arg\n\n")
	}

	u, err := url.Parse(urlArg)
	if err != nil {
		log.Fatalf("unable to parse kiali url. Err: '%s'", err)
	}

	opts := generator.Options{
		NumberOfApps:    &numAppsFlag,
		NumberOfIngress: &numIngressesFlag,
		IncludeBoxing:   &boxFlag,
	}

	kubeCfg, err := cmd.GetKubeConfig()
	if err != nil {
		log.Warningf("Unable to construct kube config because error: '%s'. Some functionality such as namespace creation may not work.", err)
	}
	if kubeCfg != nil {
		opts.KubeClient = kubernetes.NewForConfigOrDie(kubeCfg)
	}

	gen, err := generator.New(opts)
	if err != nil {
		log.Fatal(err)
	}

	var graph *common.Config
	if dataDirFlag == "" {
		log.Info("Populating graph data...")
		g := gen.Generate()
		graph = &g
	} else {
		graph, err = loadGraphFromFile(dataDirFlag)
		if err != nil {
			log.Fatalf("Unable to load graph from file. Err: %s", err)
		}

		err = gen.EnsureNamespaces(*graph)
		if err != nil {
			log.Fatalf("Unable to ensure namespaces. Err: %s", err)
		}
	}

	proxy := graphProxy{
		httpProxy: httputil.NewSingleHostReverseProxy(u),
		generator: gen,
		graph:     graph,
	}

	serveMsgTmpl := "Ready to handle requests on: '%s://localhost:10201'."
	if httpsFlag {
		log.Infof(serveMsgTmpl, "https")
		customTransport := http.DefaultTransport.(*http.Transport)
		customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		proxy.httpProxy.Transport = customTransport
		log.Fatal(http.ListenAndServeTLS(":10201", certFileFlag, keyFileFlag, proxy))
	} else {
		log.Infof(serveMsgTmpl, "http")
		log.Fatal(http.ListenAndServe(":10201", proxy))
	}
}
