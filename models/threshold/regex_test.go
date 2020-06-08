package threshold

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

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
