package models

type IstioValidations map[string]*IstioValidation
type IstioValidation struct {
	Name       string        `json:"name"`
	ObjectType string        `json:"object_type"`
	Valid      bool          `json:"valid"`
	Checks     []*IstioCheck `json:"checks"`
}

type IstioCheck struct {
	Message  string `json:"message"`
	Severity string `json:"severity"`
	Path     string `json:"path"`
}

func BuildCheck(message, severity, path string) IstioCheck {
	return IstioCheck{message, severity, path}
}

func (in IstioValidations) MergeValidations(validations *IstioValidations) IstioValidations {
	for name, validation := range *validations {
		if in[name] != nil {
			in[name].Checks = append(in[name].Checks, validation.Checks...)
			in[name].Valid = validation.Valid && in[name].Valid
		} else {
			in[name] = validation
		}
	}

	return in
}
