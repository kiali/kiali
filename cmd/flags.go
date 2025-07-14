package cmd

import (
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/kiali/kiali/log"
)

// outputFlags logs all the flags and their values for debugging purposes
func outputFlags(cmd *cobra.Command) {
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		log.Infof("Flag: %s, Value: %s", f.Name, f.Value.String())
	})
}
