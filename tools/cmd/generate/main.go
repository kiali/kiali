package main

import (
	"encoding/json"
	"flag"
	"os"
	"path"

	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tools/cmd"
	"github.com/kiali/kiali/tools/generator"
)

const (
	defaultOutputLocation = "_output"
)

var (
	boxFlag          bool
	clusterFlag      string
	numAppsFlag      int
	numIngressesFlag int
	outputFlag       string
	popStratFlag     generator.PopStratValue = generator.Sparse
)

func init() {
	flag.BoolVar(&boxFlag, "box", false, "adds boxing to the graph")
	flag.StringVar(&clusterFlag, "cluster", "test", "nodes' cluster name")
	flag.IntVar(&numAppsFlag, "apps", 5, "number of apps to create")
	flag.IntVar(&numIngressesFlag, "ingresses", 1, "number of ingresses to create")
	flag.StringVar(&outputFlag, "output", path.Join(cmd.KialiProjectRoot, defaultOutputLocation), "path to output the generated json")
	flag.Var(&popStratFlag, "population-strategy", "whether the graph should have many or few connections")
}

func filename() string {
	return "generated_graph_data.json"
}

// writeJSONToFile writes the contents to a JSON encoded file.
func writeJSONToFile(fpath string, contents interface{}) error {
	// If the file doesn't exist, create it, or append to the file
	outputPath := path.Join(fpath, filename())
	log.Infof("Outputting graph data to file: %s", outputPath)

	b, err := json.Marshal(contents)
	if err != nil {
		return err
	}

	err = os.WriteFile(outputPath, b, 0644)
	if err != nil {
		return err
	}

	return nil
}

func main() {
	flag.Usage = cmd.Usage("generate")
	flag.Parse()
	cmd.ConfigureKialiLogger()

	kubeCfg, err := cmd.GetKubeConfig()
	if err != nil {
		log.Errorf("Unable to get kube config because: '%s'. Using generator without kubeclient works but some functionality such as automatic namespace creation won't be available.", err)
	}

	popStrat := string(popStratFlag)
	opts := generator.Options{
		Cluster:            &clusterFlag,
		IncludeBoxing:      &boxFlag,
		NumberOfApps:       &numAppsFlag,
		NumberOfIngress:    &numIngressesFlag,
		PopulationStrategy: &popStrat,
	}

	if kubeCfg != nil {
		kubeClient, err := kubernetes.NewForConfig(kubeCfg)
		if err != nil {
			log.Errorf("Unable to create kube client because: '%s'. Using generator without kubeclient works but some functionality such as automatic namespace creation won't be available.", err)
		} else {
			opts.KubeClient = kubeClient
		}
	}

	g, err := generator.New(opts)
	if err != nil {
		log.Fatal(err)
	}

	log.Info("Generating graph...")
	graph := g.Generate()

	err = writeJSONToFile(outputFlag, graph)
	if err != nil {
		log.Fatal(err)
	}

	log.Info("Success!!")
}
