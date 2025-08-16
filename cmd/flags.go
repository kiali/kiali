//go:build !exclude_frontend

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/log"
)

// FileNameFlag returns a flag validation function that runs os.Stat on the flag value
// and assigns the file path to the target variable if there's no error.
//
// Usage:
//
//	var configFile string
//	cmd.PersistentFlags().FuncP("config", "c", "Path to config file", FileFlag(&configFile))
func FileNameFlag(fileName *string) func(string) error {
	return func(flagValue string) error {
		if _, err := os.Stat(flagValue); err != nil {
			return err
		}
		*fileName = flagValue
		return nil
	}
}

// Selector is a k8s label selector.
type Selector string

// LabelSelectorFlag returns a flag validation function that parses the flag value
// using k8s.io/apimachinery/pkg/labels.Parse and assigns the string to the target
// variable if there's no error.
//
// Usage:
//
//	var selector Selector
//	cmd.Flags().FuncP("selector", "s", "Label selector for pods", LabelSelectorFlag(&selector))
func LabelSelectorFlag(selector *Selector) func(string) error {
	return func(flagValue string) error {
		if _, err := labels.Parse(flagValue); err != nil {
			return fmt.Errorf("'%s' is an invalid label selector: %s", flagValue, err)
		}
		*selector = Selector(flagValue)
		return nil
	}
}

// outputFlags logs all the flags and their values for debugging purposes
func outputFlags(cmd *cobra.Command) {
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		log.Infof("Flag: %s, Value: %s", f.Name, f.Value.String())
	})
}
