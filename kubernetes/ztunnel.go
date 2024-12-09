package kubernetes

type ZtunnelConfigDump struct {
	Certificates []Certificate `json:"certificates"`
	Config       Config        `json:"config"`
	Policies     []interface{} `json:"policies"`
	Services     []Service     `json:"services"`
	Workloads    []Workload    `json:"workloads"`
}

type Certificate struct {
	CertChain []CertChain `json:"certChain"`
	Identity  string      `json:"identity"`
	State     string      `json:"state"`
}

type CertChain struct {
	ExpirationTime string `json:"expirationTime"`
	Pem            string `json:"pem"`
	SerialNumber   string `json:"serialNumber,omitempty"`
	ValidFrom      string `json:"validFrom"`
}

type Config struct {
	AdminAddr                Address            `json:"adminAddr"`
	AltCaHostname            *string            `json:"altCaHostname"`
	AltXdsHostname           *string            `json:"altXdsHostname"`
	CaAddress                string             `json:"caAddress"`
	CaRootCert               FilePath           `json:"caRootCert"`
	ClusterDomain            string             `json:"clusterDomain"`
	ClusterID                string             `json:"clusterId"`
	ConnectionWindowSize     int                `json:"connectionWindowSize"`
	DNSProxy                 bool               `json:"dnsProxy"`
	DNSProxyAddr             Address            `json:"dnsProxyAddr"`
	DNSResolverCfg           DNSResolverConfig  `json:"dnsResolverCfg"`
	DNSResolverOpts          DNSResolverOptions `json:"dnsResolverOpts"`
	FakeCa                   bool               `json:"fakeCa"`
	FakeSelfInbound          bool               `json:"fakeSelfInbound"`
	FrameSize                int                `json:"frameSize"`
	IllegalPorts             []int              `json:"illegalPorts"`
	InboundAddr              string             `json:"inboundAddr"`
	InboundPlaintextAddr     string             `json:"inboundPlaintextAddr"`
	InPodPortReuse           bool               `json:"inpodPortReuse"`
	InPodUds                 string             `json:"inpodUds"`
	LocalNode                string             `json:"localNode"`
	Network                  string             `json:"network"`
	NumWorkerThreads         int                `json:"numWorkerThreads"`
	OutboundAddr             string             `json:"outboundAddr"`
	PacketMark               int                `json:"packetMark"`
	PoolMaxStreamsPerConn    int                `json:"poolMaxStreamsPerConn"`
	PoolUnusedReleaseTimeout TimeDuration       `json:"poolUnusedReleaseTimeout"`
	Proxy                    bool               `json:"proxy"`
	ProxyArgs                string             `json:"proxyArgs"`
	ProxyMetadata            map[string]string  `json:"proxyMetadata"`
	ProxyMode                string             `json:"proxyMode"`
	ProxyWorkloadInfo        *string            `json:"proxyWorkloadInformation"`
	ReadinessAddr            SocketAddress      `json:"readinessAddr"`
	RequireOriginalSource    *string            `json:"requireOriginalSource"`
	SecretTtl                TimeDuration       `json:"secretTtl"`
	SelfTerminationDeadline  TimeDuration       `json:"selfTerminationDeadline"`
	Socks5Addr               *string            `json:"socks5Addr"`
	StatsAddr                SocketAddress      `json:"statsAddr"`
	WindowSize               int                `json:"windowSize"`
	XdsAddress               string             `json:"xdsAddress"`
	XdsOnDemand              bool               `json:"xdsOnDemand"`
	XdsRootCert              FilePath           `json:"xdsRootCert"`
}

type Address struct {
	Localhost []interface{} `json:"Localhost"`
}

type FilePath struct {
	File string `json:"File"`
}

type DNSResolverConfig struct {
	Domain      *string      `json:"domain"`
	NameServers []NameServer `json:"name_servers"`
	Search      []string     `json:"search"`
}

type NameServer struct {
	BindAddr               *string `json:"bind_addr"`
	Protocol               string  `json:"protocol"`
	SocketAddr             string  `json:"socket_addr"`
	TlsDnsName             *string `json:"tls_dns_name"`
	TrustNegativeResponses bool    `json:"trust_negative_responses"`
}

type DNSResolverOptions struct {
	Attempts               int          `json:"attempts"`
	AuthenticData          bool         `json:"authentic_data"`
	CacheSize              int          `json:"cache_size"`
	CheckNames             bool         `json:"check_names"`
	Edns0                  bool         `json:"edns0"`
	IpStrategy             string       `json:"ip_strategy"`
	Ndots                  int          `json:"ndots"`
	NegativeMaxTtl         *string      `json:"negative_max_ttl"`
	NegativeMinTtl         *string      `json:"negative_min_ttl"`
	NumConcurrentReqs      int          `json:"num_concurrent_reqs"`
	PositiveMaxTtl         *string      `json:"positive_max_ttl"`
	PositiveMinTtl         *string      `json:"positive_min_ttl"`
	PreserveIntermediates  bool         `json:"preserve_intermediates"`
	RecursionDesired       bool         `json:"recursion_desired"`
	Rotate                 bool         `json:"rotate"`
	ServerOrderingStrategy string       `json:"server_ordering_strategy"`
	ShuffleDnsServers      bool         `json:"shuffle_dns_servers"`
	Timeout                TimeDuration `json:"timeout"`
	TryTcpOnError          bool         `json:"try_tcp_on_error"`
	UseHostsFile           bool         `json:"use_hosts_file"`
	Validate               bool         `json:"validate"`
}

type TimeDuration struct {
	Nanos int `json:"nanos"`
	Secs  int `json:"secs"`
}

type SocketAddress struct {
	SocketAddr string `json:"SocketAddr"`
}

type Service struct {
	Endpoints       map[string]Endpoint `json:"endpoints"`
	Hostname        string              `json:"hostname"`
	IpFamilies      string              `json:"ipFamilies"`
	Name            string              `json:"name"`
	Namespace       string              `json:"namespace"`
	Ports           map[string]int      `json:"ports"`
	SubjectAltNames []string            `json:"subjectAltNames"`
	Vips            []string            `json:"vips"`
	Waypoint        Waypoint            `json:"waypoint"`
}

type Endpoint struct {
	Port        map[string]int `json:"port"`
	Status      string         `json:"status"`
	WorkloadUid string         `json:"workloadUid"`
}

type Waypoint struct {
	Destination   string `json:"destination"`
	HboneMtlsPort int    `json:"hboneMtlsPort"`
}

type Workload struct {
	CanonicalName     string   `json:"canonicalName"`
	CanonicalRevision string   `json:"canonicalRevision"`
	ClusterID         string   `json:"clusterId"`
	Name              string   `json:"name"`
	Namespace         string   `json:"namespace"`
	NetworkMode       string   `json:"networkMode"`
	Node              string   `json:"node"`
	Protocol          string   `json:"protocol"`
	ServiceAccount    string   `json:"serviceAccount"`
	Services          []string `json:"services"`
	Status            string   `json:"status"`
	TrustDomain       string   `json:"trustDomain"`
	Uid               string   `json:"uid"`
	WorkloadIps       []string `json:"workloadIps"`
	WorkloadName      string   `json:"workloadName"`
	WorkloadType      string   `json:"workloadType"`
}
