package threshold

import (
	"fmt"
	"regexp"
	"strconv"
)

var ruleRegex = regexp.MustCompile(`^(<|>|<=|>=|==|!=)?([0-9]+)$`)

// Check if variable
var checkX = regexp.MustCompile(`x|X`)

/*
 Regex forresponse_code
*/

var responseCodeRegex = regexp.MustCompile(`^(x|X|[0-9]+)(<|>|<=|>=|==|!=)(x|X|[0-9]+)(<|>|<=|>=|==|!=)?(x|X|[0-9]+)?$`)

/*
	Check the Rule expression
	Return
		- err: Error if not match
		- op: the operation string ">","<" ....
		- percent: the integer to check
*/
func CheckRule(expr string) (err error, op string, percent int) {
	steps := delete_empty(ruleRegex.FindStringSubmatch(expr))
	if ruleRegex.MatchString(expr) {
		op = "=="
		auxPercent := steps[1]
		if len(steps) == 3 {
			op = steps[1]
			auxPercent = steps[2]
		}
		if percent, err := strconv.Atoi(auxPercent); err == nil {
			return nil, op, percent
		}
		return fmt.Errorf("Error percent %s is not an integer", auxPercent), "", -1
	}
	return fmt.Errorf("Error %s not match %s", expr, ruleRegex), "", -1
}

/*
	Return the regex for a given string
*/
func GetRegex(expr string) *regexp.Regexp {
	return regexp.MustCompile(expr)
}

/*
	Check if expression match with a regex
	Return:
		- error: Error if not match
		- []string: An array of strings with results.
*/
func CheckExpr(expr string, regex regexp.Regexp) (error, []string) {
	steps := delete_empty(regex.FindStringSubmatch(expr))
	// The Expression match the regex and there is only a X|x
	if regex.MatchString(expr) {
		return nil, steps
	}
	return fmt.Errorf("Error %s not match %s", expr, regex.String()), []string{}
}

/*
	Check If a expression have a variable x|X for response_code case
		expr: string with expression
		n: number of times that the expression should be in the string (1)

*/
func CheckVariable(expr string, n int) bool {
	if checkX.MatchString(expr) && len(checkX.FindAllStringIndex(expr, -1)) == n {
		return true
	}
	return false
}
