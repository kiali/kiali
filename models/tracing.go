package models

type JaegerInfo struct {
	Enabled              bool     `json:"enabled"`
	Integration          bool     `json:"integration"`
	URL                  string   `json:"url"`
	NamespaceSelector    bool     `json:"namespaceSelector"`
	WhiteListIstioSystem []string `json:"whiteListIstioSystem"`
}
