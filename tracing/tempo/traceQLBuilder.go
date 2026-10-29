package tempo

import (
	"fmt"
	"reflect"
	"strings"
)

type operandType string

const (
	AND      operandType = "&&"
	OR       operandType = "||"
	EQUAL    operandType = "="
	NOTEQUAL operandType = "!="
	REGEX    operandType = "=~"
)

// traceSelects is the select(...) list shared by the HTTP and gRPC TraceQL
// builders so the two cannot drift. Beyond the attributes the UI renders, it
// must keep selecting the attributes the per-trace list authorization reads
// (business.traceInNamespace, through model.NamespaceTagKeys and
// model.ClusterTagKeys): the namespace- and cluster-bearing span attributes
// (istio.namespace, istio.cluster_id) and the OTel resource attributes
// (k8s.namespace.name, k8s.cluster.name). Tempo reports them unqualified in
// search responses (a resource.k8s.namespace.name select comes back as the
// k8s.namespace.name attribute), matching the tag keys the extraction
// recognizes. Without these selects, a trace whose namespace exists only as
// a resource attribute would be dropped from every list view (fail closed)
// while remaining accessible through the trace details, which fetch the full
// trace.
var traceSelects = []string{
	"status",
	".service_name",
	".node_id",
	".component",
	".upstream_cluster",
	".http.method",
	".response_flags",
	".istio.destination_workload",
	".istio.destination_namespace",
	".istio.destination_instance_name",
	".istio.destination_canonical_service",
	".istio.source_workload",
	".istio.source_namespace",
	".istio.source_instance_name",
	".istio.source_canonical_service",
	"resource.hostname",
	// Authorization attributes; see the comment above.
	".istio.namespace",
	".istio.cluster_id",
	"resource.k8s.namespace.name",
	"resource.k8s.cluster.name",
	"name",
}

type TraceQL struct {
	operator1 interface{}
	operand   operandType
	operator2 interface{}
}

// Groups are ()
type Group struct {
	group   []TraceQL
	operand operandType
}

// Subqueries are {}
type Subquery struct {
	trace TraceQL
}

func printOperator(operator interface{}) string {

	queryString := ""
	valueType := reflect.TypeOf(operator)

	switch valueType.String() {
	case "tempo.Subquery":
		queryString = fmt.Sprintf("{ %s }", printOperator(operator.(Subquery).trace))
	case "tempo.Group":
		queryString = "( "
		for i, op := range operator.(Group).group {
			queryString += fmt.Sprintf(" %s ", printOperator(op))
			if i < len(operator.(Group).group)-1 {
				queryString += fmt.Sprintf(" %s ", operator.(Group).operand)
			}
		}
		queryString += ")"
	case "tempo.TraceQL":
		if operator.(TraceQL).operator1 != nil {
			if reflect.TypeOf(operator.(TraceQL).operator2).String() == "string" {
				queryString = fmt.Sprintf("%s %s \"%s\" ", operator.(TraceQL).operator1,
					operator.(TraceQL).operand, operator.(TraceQL).operator2)
			} else {
				if reflect.TypeOf(operator.(TraceQL).operator2).String() == "tempo.unquoted" {
					queryString = fmt.Sprintf("%s %s %s ", operator.(TraceQL).operator1,
						operator.(TraceQL).operand, operator.(TraceQL).operator2)
				} else {
					queryString = fmt.Sprintf("%s %s %s ", printOperator(operator.(TraceQL).operator1),
						operator.(TraceQL).operand, printOperator(operator.(TraceQL).operator2))
				}

			}

		}
	case "string":
		queryString = fmt.Sprintf("%s", operator)
	}
	return queryString
}

func printSelect(fields []string) string {
	selects := strings.Join(fields, ", ")
	return fmt.Sprintf("select(%s)", selects)
}
