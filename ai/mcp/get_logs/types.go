package get_logs

// GetLogsArgs are the supported input parameters. This is echoed back in the response for transparency.
type GetLogsArgs struct {
	ClusterName string `json:"cluster_name,omitempty"`
	Namespace   string `json:"namespace,omitempty"`
	// Requested is the user-provided name, which can be a Pod name or a Workload name.
	Requested  string   `json:"requested,omitempty"`
	Pod        string   `json:"pod,omitempty"`
	Workload   string   `json:"workload,omitempty"`
	Container  string   `json:"container,omitempty"`
	TailLines  int      `json:"tail_lines,omitempty"`
	Severities []string `json:"severities,omitempty"`
	Previous   bool     `json:"previous,omitempty"`
	// Format controls how logs are returned. "plain" matches kubernetes-mcp-server pods_log (raw text)
	// "codeblock" wraps output in ~~~ fences for readable chat rendering
	Format string `json:"format,omitempty"`
	// Analyze controls whether the AI model should analyze the logs (true) or return them directly (false, default)
	Analyze bool `json:"analyze,omitempty"`
}

type GetLogsResponse struct {
	Query            GetLogsArgs `json:"query"`
	Lines            []string    `json:"lines,omitempty"`
	ReturnedLines    int         `json:"returned_lines,omitempty"`
	MatchedLines     int         `json:"matched_lines,omitempty"`
	TruncatedByBytes bool        `json:"truncated_by_bytes,omitempty"`
	Warnings         []string    `json:"warnings,omitempty"`
}
