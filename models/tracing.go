package models

type JaegerInfo struct {
	Enabled              bool     `json:"enabled"`
	Integration          bool     `json:"integration"`
	URL                  string   `json:"url"`
	NamespaceSelector    bool     `json:"namespaceSelector"`
	WhiteListIstioSystem []string `json:"whiteListIstioSystem"`
}

type TracingQuery struct {
	StartMicros string `json:"startMicros"`
	EndMicros   string `json:"endMicros"`
	Tags        string `json:"tags"`
	MinDuration string `json:"minDuration"`
	Limit       int    `json:"limit"`
}
