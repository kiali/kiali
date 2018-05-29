package models

// IstioValidationKey is the key value composed of an Istio ObjectType and Name.
type IstioValidationKey struct {
	ObjectType string
	Name       string
}

// IstioValidations represents a set of IstioValidation grouped by IstioValidationKey.
type IstioValidations map[IstioValidationKey]*IstioValidation

// IstioValidation represents a list of checks associated to an Istio object.
type IstioValidation struct {
	Name       string        `json:"name"`       // Name of the object itself
	ObjectType string        `json:"objectType"` // Type of the object
	Valid      bool          `json:"valid"`      // Represents validity of the object: in case of warning, validity remainds as true
	Checks     []*IstioCheck `json:"checks"`     // Array of checks
}

// IstioCheck represents an individual check.
type IstioCheck struct {
	Message  string `json:"message"`  // Description of the check
	Severity string `json:"severity"` // Indicates the level of importance: error or warning
	Path     string `json:"path"`     // String that describes where in the yaml file is the check located
}

func BuildCheck(message, severity, path string) IstioCheck {
	return IstioCheck{Message: message, Severity: severity, Path: path}
}

func (iv IstioValidations) MergeValidations(validations IstioValidations) IstioValidations {
	for key, validation := range validations {
		v, ok := iv[key]
		if !ok {
			iv[key] = validation
		} else {
			v.Checks = append(v.Checks, validation.Checks...)
			v.Valid = v.Valid && validation.Valid
		}
	}
	return iv
}
