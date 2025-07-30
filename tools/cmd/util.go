// Shared helpers across commands.
package cmd

import (
	"flag"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/kiali/kiali/log"
)

var (
	// Adapted from: https://stackoverflow.com/a/38644571
	_, b, _, _ = runtime.Caller(0)
	basepath   = filepath.Dir(b)
	// This works so long as the current dir structure stays the same.
	// This should be the base of the project e.g. '/home/user1/kiali'.
	// If the location of this file changes, this needs to be updated as well.
	KialiProjectRoot = path.Dir(path.Dir(basepath))
)

// GetKubeConfig constructs a kube config from either the user's local kube config
// or the KUBECONFIG env var.
func GetKubeConfig() (*rest.Config, error) {
	kubeconfig := os.Getenv("KUBECONFIG")

	if len(kubeconfig) == 0 {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("unable to find user home dir. Err: %w", err)
		}
		kubeconfig = fmt.Sprintf("%s/.kube/config", home)
	}

	restConfig, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("unable to build config from flags: %w", err)
	}

	return restConfig, nil
}

func ConfigureKialiLogger() {
	// Kiali logger is configured through env vars and the default format is json which isn't very nice for cmdline.
	if err := os.Setenv("LOG_FORMAT", "text"); err != nil {
		log.Errorf("Unable to configure logger. Err: %s", err)
	} else {
		log.InitializeLogger()
	}
}

// Usage creates a custom usage function that allows you to specify position
// arguments and prints flags with two dashes instead of one e.g. '--url'
// instead of '-url'.
//
// You can assign this to flag.Usage directly or any other FlagSet.Usage
// e.g. 'flag.Usage = Usage(requiredFlag1)'.
//
// The resulting Usage will look like:
// Usage: cmd <pos-arg1> <pos-arg2> ... [Options]
//
// Options:
// --opt1 string
// opt description (default "")
// ...
func Usage(cmd string, posArgs ...string) func() {
	return func() {
		var b strings.Builder
		fmt.Fprintf(&b, "Usage: %s ", cmd)
		for _, arg := range posArgs {
			b.WriteString(arg + " ")
		}
		b.WriteString("[Options]\n\n")
		b.WriteString("Options:\n")
		flag.VisitAll(func(f *flag.Flag) {
			fType, _ := flag.UnquoteUsage(f)
			fmt.Fprintf(&b, "  --%s %s\n", f.Name, fType)

			b.WriteString("\t" + f.Usage)
			if f.DefValue == "" {
				fmt.Fprintf(&b, " (default %q)\n", f.DefValue)
			} else {
				fmt.Fprintf(&b, " (default %s)\n", f.DefValue)
			}
		})
		fmt.Fprint(flag.CommandLine.Output(), b.String())
	}
}
