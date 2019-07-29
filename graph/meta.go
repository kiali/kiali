package graph

// MetadataKey is a mnemonic type name for string
type MetadataKey string

// Metadata is a map for storing node and edge metadata values reported by the vendors
type Metadata map[MetadataKey]interface{}

// NewMetadata returns an empty Metadata map
func NewMetadata() Metadata {
	return make(map[MetadataKey]interface{})
}

// Metadata keys to be used instead of literal strings
const (
	DestServices    MetadataKey = "destServices"
	HasCB           MetadataKey = "hasCB"
	HasMissingSC    MetadataKey = "hasMissingSC"
	HasVS           MetadataKey = "hasVS"
	IsDead          MetadataKey = "isDead"
	IsInaccessible  MetadataKey = "isInaccessible"
	IsMisconfigured MetadataKey = "isMisconfigured"
	IsMTLS          MetadataKey = "isMTLS"
	IsOutside       MetadataKey = "isOutside"
	IsRoot          MetadataKey = "isRoot"
	IsServiceEntry  MetadataKey = "isServiceEntry"
	IsUnused        MetadataKey = "isUnused"
	ProtocolKey     MetadataKey = "protocol"
	ResponseTime    MetadataKey = "responseTime"
)

// DestServicesMetadata key=Service.Key()
type DestServicesMetadata map[string]Service

// NewDestServicesMetadata returns an empty DestServicesMetadata map
func NewDestServicesMetadata() DestServicesMetadata {
	return make(map[string]Service)
}

// Add adds or replaces a destService
func (dsm DestServicesMetadata) Add(key string, service Service) DestServicesMetadata {
	dsm[key] = service
	return dsm
}
