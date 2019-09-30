package main

import (
	"fmt"

	"github.com/kiali/k-charted/business"
	"github.com/kiali/k-charted/config"
	"github.com/kiali/k-charted/log"
)

func main() {
	fmt.Printf("Hello, Charts")
	business.NewDashboardsService(config.Config{GlobalNamespace: "istio-system"}, log.LogAdapter{})
}
