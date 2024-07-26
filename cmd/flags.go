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

// setupPortForwarding configures port forwarding for Prometheus and Tracing services
// when running in local mode.
type portForwardingOptions struct {
	dashboardSelector        Selector
	dashboardsPort           string
	enableDashboards         bool
	enableTracing            bool
	metricsPort              string
	metricsSelector          Selector
	portForwardToGrafanaFlag bool
	portForwardToPromFlag    bool
	portForwardToTracingFlag bool
	tracingPort              string
	tracingSelector          Selector
}

// newPortForwardingOptions creates a new portForwardingOptions with default values
func newPortForwardingOptions() *portForwardingOptions {
	return &portForwardingOptions{
		dashboardSelector:        Selector("app.kubernetes.io/name=grafana"),
		dashboardsPort:           "3000",
		enableDashboards:         false,
		enableTracing:            false,
		metricsPort:              "9090",
		metricsSelector:          Selector("app.kubernetes.io/name=prometheus"),
		portForwardToGrafanaFlag: false,
		portForwardToPromFlag:    false,
		portForwardToTracingFlag: false,
		tracingPort:              "16686",
		tracingSelector:          Selector("app=jaeger"),
	}
}

// addFlags adds all port forwarding related flags to the given command
func (opts *portForwardingOptions) addFlags(cmd *cobra.Command) {
	cmd.Flags().BoolVar(&opts.portForwardToPromFlag, "port-forward-prom", opts.portForwardToPromFlag,
		"Enables port-forwarding to the Prometheus pod in the home cluster. Use this when your metrics store is not accessible from the outside of the cluster. Otherwise set the URL in the config file.")
	cmd.Flags().BoolVar(&opts.portForwardToGrafanaFlag, "port-forward-grafana", opts.portForwardToGrafanaFlag,
		"Enables port-forwarding to the Grafana pod in the home cluster. Use this when your dashboard service is not accessible from the outside of the cluster. Otherwise set the URL in the config file.")
	cmd.Flags().BoolVar(&opts.portForwardToTracingFlag, "port-forward-tracing", opts.portForwardToTracingFlag,
		"Enables port-forwarding to the Jaeger pod in the home cluster. Use this when your tracing service is not accessible from the outside of the cluster. Otherwise set the URL in the config file.")
	cmd.Flags().BoolVar(&opts.enableTracing, "enable-tracing", opts.enableTracing, "Enable tracing.")
	cmd.Flags().BoolVar(&opts.enableDashboards, "enable-dashboards", opts.enableDashboards, "Enable dashboards.")
	cmd.Flags().StringVar(&opts.tracingPort, "tracing-port", opts.tracingPort, "Port number to use for tracing port forwarding.")
	cmd.Flags().StringVar(&opts.metricsPort, "metrics-port", opts.metricsPort, "Port number to use for metrics port forwarding.")
	cmd.Flags().StringVar(&opts.dashboardsPort, "dashboards-port", opts.dashboardsPort, "Port number to use for dashboards port forwarding.")
	cmd.Flags().Func("tracing-selector", fmt.Sprintf("Label selector to find tracing pods when port-forwarding is enabled (default: %s)", opts.tracingSelector), LabelSelectorFlag(&opts.tracingSelector))
	cmd.Flags().Func("dashboard-selector", fmt.Sprintf("Label selector to find dashboard pods when port-forwarding is enabled (default: %s)", opts.dashboardSelector), LabelSelectorFlag(&opts.dashboardSelector))
	cmd.Flags().Func("metrics-selector", fmt.Sprintf("Label selector to find metrics pods when port-forwarding is enabled (default: %s)", opts.metricsSelector), LabelSelectorFlag(&opts.metricsSelector))
}
