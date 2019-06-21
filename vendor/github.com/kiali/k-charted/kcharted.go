package main

import (
	"fmt"

	"github.com/kiali/k-charted/business"
	"github.com/kiali/k-charted/config"
)

func main() {
	fmt.Printf("Hello, Charts")
	business.NewDashboardsService(config.Config{GlobalNamespace: "istio-system"})
}
