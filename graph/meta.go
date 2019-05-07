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
