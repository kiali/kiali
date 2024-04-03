package mesh

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
	HealthData     MetadataKey = "healthData"
	InfraData      MetadataKey = "infraData"
	IsExternal     MetadataKey = "isExternal"
	IsInaccessible MetadataKey = "isInaccessible"
	IsMTLS         MetadataKey = "isMTLS"
)
