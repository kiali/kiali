//go:build !exclude_frontend

package cmd

import (
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/kiali/kiali/log"
)

// FileNameFlag returns a flag validation function that runs os.Stat on the flag value
// and assigns the file path to the target variable if there's no error.
// This function returns a closure that satisfies the func(flagValue string) error signature
// required by cobra's FuncP and similar flag methods.
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

// outputFlags logs all the flags and their values for debugging purposes
func outputFlags(cmd *cobra.Command) {
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		log.Infof("Flag: %s, Value: %s", f.Name, f.Value.String())
	})
}
