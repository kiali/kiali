package list_clusters

import (
	"net/http"

	"github.com/kiali/kiali/ai/mcputil"
)

type ClusterInfo struct {
	IsHome bool   `json:"isHome"`
	Name   string `json:"name"`
}

func Execute(ki *mcputil.KialiInterface, _ map[string]interface{}) (interface{}, int) {
	clusters := ki.Discovery.Clusters()

	result := make([]ClusterInfo, 0, len(clusters))
	for _, c := range clusters {
		if !c.Accessible {
			continue
		}
		result = append(result, ClusterInfo{
			IsHome: c.IsKialiHome,
			Name:   c.Name,
		})
	}

	return result, http.StatusOK
}
