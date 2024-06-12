package models

// BuildInfo contains information about the kiali build.
type BuildInfo struct {
	CommitHash       string `json:"commitHash"`
	ContainerVersion string `json:"containerVersion"`
	GoVersion        string `json:"goVersion"`
	Version          string `json:"version"`
}
