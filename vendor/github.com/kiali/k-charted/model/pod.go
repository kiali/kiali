package model

// Pod is a simple interface to get annotations
type Pod interface {
	GetAnnotations() map[string]string
}
