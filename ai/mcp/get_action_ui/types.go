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
}
