package models

type JaegerInfo struct {
	Enabled           bool   `json:"enabled"`
	URL               string `json:"url"`
	NamespaceSelector bool   `json:"namespaceSelector"`
}
