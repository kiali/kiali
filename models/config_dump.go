package models

import (
	adminapi "github.com/envoyproxy/go-control-plane/envoy/admin/v3"
	cluster "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
	"github.com/golang/protobuf/ptypes"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/config_dump"
)

type ConfigDump struct {
	configDump *config_dump.ConfigDump

	Clusters  ClusterDump `json:"clusters"`
	Endpoints interface{} `json:"endpoints"`
	Listeners interface{} `json:"listeners"`
	Routes    interface{} `json:"routes"`
	Secrets   interface{} `json:"secrets"`
}

type ClusterDump struct {
	VersionInfo           string      `json:"version_info"`
	StaticClusters        interface{} `json:"static_clusters"`
	DynamicActiveClusters interface{} `json:"dynamic_active_clusters"`
}

type Cluster struct {
	Cluster     *cluster.Cluster `json:"cluster"`
	LastUpdated string           `json:"last_updated"`
	VersionInfo string           `json:"version_info,omitempty"`
}

func NewConfigDump(dump *config_dump.ConfigDump) *ConfigDump {
	cd := &ConfigDump{}
	cd.configDump = dump
	return cd
}

func (cd *ConfigDump) UnmarshallAll() {
	cd.UnmarshallClusters()
	cd.UnmarshallEndpoints()
	cd.UnmarshallListeners()
	cd.UnmarshallRoutes()
	cd.UnmarshallSecrets()
}

func (cd *ConfigDump) UnmarshallClusters() {
	clusterDump := &adminapi.ClustersConfigDump{}
	clusterStruct := ClusterDump{}

	clusterAny := cd.configDump.GetConfig("type.googleapis.com/envoy.admin.v3.ClustersConfigDump")
	if clusterAny == nil {
		return
	}

	err := ptypes.UnmarshalAny(clusterAny, clusterDump)
	if err != nil {
		log.Errorf("Error unmarshalling config_dump.config: %v", err)
		return
	}

	clusterStruct.VersionInfo = clusterDump.VersionInfo

	clusters := make([]Cluster, 0)
	for _, c := range clusterDump.DynamicActiveClusters {
		if c.Cluster != nil {
			dcd := &cluster.Cluster{}
			err = ptypes.UnmarshalAny(c.Cluster, dcd)
			if err != nil {
				continue
			}
			clusters = append(clusters, Cluster{
				Cluster:     dcd,
				LastUpdated: ptypes.TimestampString(c.LastUpdated),
				VersionInfo: c.VersionInfo,
			})
		}
	}
	clusterStruct.DynamicActiveClusters = clusters

	clusters = make([]Cluster, 0)
	for _, c := range clusterDump.StaticClusters {
		if c.Cluster != nil {
			dcd := &cluster.Cluster{}
			err = ptypes.UnmarshalAny(c.Cluster, dcd)
			if err != nil {
				continue
			}
			clusters = append(clusters, Cluster{Cluster: dcd, LastUpdated: ptypes.TimestampString(c.LastUpdated)})
		}
	}
	clusterStruct.StaticClusters = clusters

	cd.Clusters = clusterStruct
}

func (cd *ConfigDump) UnmarshallEndpoints() {

}

func (cd *ConfigDump) UnmarshallListeners() {

}

func (cd *ConfigDump) UnmarshallRoutes() {

}

func (cd *ConfigDump) UnmarshallSecrets() {

}
