package threshold

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

var batteryCheckExpr = map[string][]string{
	"x<300":      []string{"x<300", "x", "<", "300"},
	"300<=X":     []string{"300<=X", "300", "<=", "X"},
	"200<=x<300": []string{"200<=x<300", "200", "<=", "x", "<", "300"},
	"x==300":     []string{"x==300", "x", "==", "300"},
	"x!=400":     []string{"x!=400", "x", "!=", "400"},
	"x>=200":     []string{"x>=200", "x", ">=", "200"},
}

var errBatteryCheckExpr = []string{
	"asda", "<Z", "X<200<Z", "300-X<200",
}

func TestCheckExpr(t *testing.T) {

	for k, v := range batteryCheckExpr {
		error, result := CheckExpr(k, *responseCodeRegex)
		assert.Equal(t, error, nil)
		assert.Equal(t, result, v)
	}
	error, result := CheckExpr("x<300", *responseCodeRegex)
	assert.Equal(t, error, nil)
	assert.Equal(t, result, []string{"x<300", "x", "<", "300"})

	for _, v := range errBatteryCheckExpr {
		_, result := CheckExpr(v, *responseCodeRegex)
		//assert.Equal(t,error.Error(),fmt.Sprintf("Error %s not match %s",v, *responseCodeRegex.String()))
		assert.Equal(t, result, []string{})
	}
}

var batteryCheckVariable = []string{
	"x<300", "300>X",
}

var errBatteryCheckVariable = []string{
	"asda", "<Z",
}

func TestCheckVariable(t *testing.T) {
	for _, v := range batteryCheckVariable {
		result := CheckVariable(v, 1)
		assert.Equal(t, true, result)
	}
	result := CheckVariable("x<300<X", 2)
	assert.Equal(t, true, result)

	for _, v := range errBatteryCheckVariable {
		result := CheckVariable(v, 1)
		assert.Equal(t, false, result)
	}
}

var batteryCheckRule = map[string][]string{
	"<20":  []string{"<", "20"},
	">=30": []string{">=", "30"},
}

var errBatteryCheckRule = []string{
	"asda", "<Z",
}

func TestCheckRule(t *testing.T) {

	for k, v := range batteryCheckRule {
		error, op, percent := CheckRule(k)
		assert.Equal(t, v[0], op)
		percentExp, _ := strconv.Atoi(v[1])
		assert.Equal(t, percentExp, percent)
		assert.Equal(t, nil, error)
	}

	for _, v := range errBatteryCheckRule {
		err, op, percent := CheckRule(v)
		assert.Equal(t, "", op)
		assert.Equal(t, -1, percent)
		assert.Equal(t, fmt.Errorf("Error %s not match %s", v, ruleRegex), err)
	}

	//Error conversion to int
	rule := ">=a"
	err, op, percent := CheckRule(rule)
	assert.Equal(t, "", op)
	assert.Equal(t, -1, percent)
	//assert.Equal(t,error.Error(),fmt.Sprintf("Error %s not match %s",v, *responseCodeRegex.String()))
	assert.Equal(t, fmt.Errorf("Error %s not match %s", rule, ruleRegex), err)
}
