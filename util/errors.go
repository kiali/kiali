package util

import (
	"errors"
	"fmt"
	"strings"
)

// Errors is a struct implementing error interface, allowing to accumulate several errors as a flat list
type Errors struct {
	errors []error
}

func (in *Errors) Add(err error) {
	in.errors = append(in.errors, err)
}

func (in *Errors) AddString(str string) {
	in.errors = append(in.errors, errors.New(str))
}

func (in *Errors) Count() int {
	return len(in.errors)
}

func (in *Errors) IsEmpty() bool {
	return len(in.errors) == 0
}

func (in *Errors) Merge(others *Errors) {
	in.errors = append(in.errors, others.errors...)
}

func (in *Errors) Strings() []string {
	var str []string
	for _, err := range in.errors {
		str = append(str, err.Error())
	}
	return str
}

func (in *Errors) Error() string {
	return fmt.Sprintf("%d errors:\n%s", in.Count(), strings.Join(in.Strings(), "\n"))
}

func (in *Errors) OrNil() *Errors {
	if in.IsEmpty() {
		return nil
	}
	return in
}
