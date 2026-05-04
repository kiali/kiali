package get_action_ui

// ActionKind represents the type of action.
type ActionKind string

const (
	ActionKindNavigation ActionKind = "navigation"
	ActionKindFile       ActionKind = "file"
)

// Action represents a button the user can click.
type Action struct {
	FileName string     `json:"fileName,omitempty"`
	Title    string     `json:"title"`
	Kind     ActionKind `json:"kind"`
	Payload  string     `json:"payload"`

	// Optional metadata for file actions, so the UI can offer an editor and apply the change directly.
	Operation string `json:"operation,omitempty"` // create|patch|delete
	Cluster   string `json:"cluster,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Group     string `json:"group,omitempty"`
	Version   string `json:"version,omitempty"`
	KindName  string `json:"kindName,omitempty"`
	Object    string `json:"object,omitempty"`
}
