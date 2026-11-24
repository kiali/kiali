package get_troubleshooting_snapshot

import "time"

type TroubleshootingSnapshotArgs struct {
	ClusterName            string    `json:"clusterName,omitempty"`
	Direction              string    `json:"direction,omitempty"`
	DurationSeconds        int       `json:"-"`
	GraphType              string    `json:"graphType,omitempty"`
	IncludeEnvoyConfigDump bool      `json:"includeEnvoyConfigDump"`
	IncludeGraph           bool      `json:"includeGraph"`
	IncludeLogs            bool      `json:"includeLogs"`
	IncludeMetrics         bool      `json:"includeMetrics"`
	IncludeTraces          bool      `json:"includeTraces"`
	MaxEnvoyConfigDumps    int       `json:"maxEnvoyConfigDumps"`
	MaxLogPods             int       `json:"maxLogPods"`
	Namespace              string    `json:"namespace"`
	Reporter               string    `json:"reporter,omitempty"`
	ServiceName            string    `json:"serviceName,omitempty"`
	Since                  string    `json:"since"`
	SinceTime              time.Time `json:"-"`
	To                     string    `json:"to"`
	ToTime                 time.Time `json:"-"`
	WorkloadName           string    `json:"workloadName,omitempty"`
}

type SourceStatus struct {
	Enabled  bool   `json:"enabled"`
	Included bool   `json:"included"`
	Reason   string `json:"reason,omitempty"`
}

type SourceResult struct {
	Cluster   string      `json:"cluster"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Kind      string      `json:"kind"`
	Name      string      `json:"name"`
	Namespace string      `json:"namespace"`
}

type TargetSummary struct {
	Cluster   string   `json:"cluster"`
	Kind      string   `json:"kind"`
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Workloads []string `json:"workloads,omitempty"`
}

type LogEntry struct {
	Message   string `json:"message,omitempty"`
	Severity  string `json:"severity,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

type LogsResult struct {
	Entries        []LogEntry `json:"entries,omitempty"`
	LinesTruncated bool       `json:"linesTruncated,omitempty"`
}

type TraceSummary struct {
	DurationMs    float64 `json:"durationMs"`
	HasErrors     bool    `json:"hasErrors"`
	ID            string  `json:"id"`
	RootOperation string  `json:"rootOperation,omitempty"`
	SpansCount    int     `json:"spansCount"`
}

type TracesResult struct {
	Service    string         `json:"service"`
	TotalFound int            `json:"totalFound"`
	Traces     []TraceSummary `json:"traces"`
}

type TroubleshootingSnapshotResponse struct {
	EnvoyConfigDumps []SourceResult              `json:"envoyConfigDumps,omitempty"`
	Errors           map[string]string           `json:"errors,omitempty"`
	Graph            interface{}                 `json:"graph,omitempty"`
	Logs             []SourceResult              `json:"logs,omitempty"`
	Metrics          interface{}                 `json:"metrics,omitempty"`
	Query            TroubleshootingSnapshotArgs `json:"query"`
	Sources          map[string]SourceStatus     `json:"sources"`
	Target           TargetSummary               `json:"target"`
	Traces           interface{}                 `json:"traces,omitempty"`
	Warnings         []string                    `json:"warnings,omitempty"`
}
