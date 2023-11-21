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
