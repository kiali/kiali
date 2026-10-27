package troubleshooting

const (
	CategoryControlPlane       = "control_plane"
	CategoryDataPlane          = "data_plane"
	CategoryIstioObjects       = "istio_objects"
	CategoryObservabilityStack = "observability_stack"
	CategoryConnectivity       = "connectivity"

	SeverityCritical = "critical"
	SeverityWarning  = "warning"

	ActionTypeAdvice   = "Advice"
	ActionTypeAnalyze  = "Analyze"
	ActionTypeApply    = "Apply"
	ActionTypeFix      = "Fix"
	ActionTypeQuestion = "Question"

	UIActionAsk = "Ask"
	UIActionFix = "Fix"
)

// Request is the POST /api/ai/troubleshooting body.
// Empty action and prompt run a mesh scan via the troubleshooting tool.
type Request struct {
	Action      string `json:"action,omitempty"`
	Prompt      string `json:"prompt,omitempty"`
	Namespace   string `json:"namespace,omitempty"`
	ClusterName string `json:"clusterName,omitempty"`
}

type Issue struct {
	ID          string       `json:"id"`
	Category    string       `json:"category"`
	Problem     string       `json:"problem"`
	Description string       `json:"description,omitempty"`
	SubProblems []SubProblem `json:"subProblems"`
}

type SubProblem struct {
	Checks           []ValidationCheck `json:"checks,omitempty"`
	ID               string            `json:"id"`
	Impact           string            `json:"impact"`
	Issue            string            `json:"issue"`
	IstioObject      *IstioObjectRef   `json:"istioObject,omitempty"`
	Severity         string            `json:"severity,omitempty"`
	SuggestedActions []SuggestedAction `json:"suggestedActions,omitempty"`
	SuggestedPrompt  string            `json:"suggestedPrompt,omitempty"`
	Target           string            `json:"target"`
}

// IstioObjectRef identifies an Istio config object so the UI can open its details page.
type IstioObjectRef struct {
	Group     string `json:"group"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Version   string `json:"version"`
}

// ValidationCheck is one Kiali validation result on an Istio object.
// Several checks for the same object share one sub-problem.
type ValidationCheck struct {
	Code            string `json:"code"`
	Message         string `json:"message"`
	Path            string `json:"path,omitempty"`
	Severity        string `json:"severity,omitempty"`
	SuggestedPrompt string `json:"suggestedPrompt,omitempty"`
}

type SuggestedAction struct {
	Command     string `json:"command,omitempty"`
	Description string `json:"description"`
	Prompt      string `json:"prompt,omitempty"`
	Type        string `json:"type"`
	YAML        string `json:"yaml,omitempty"`
}
