package models

// Annotationkey is a mnemonic type name for string
type AnotationKey string

const (
	AllHealthAnnotation  AnotationKey = ".*"
		RateHealthAnnotation AnotationKey = "health.kiali.io/rate"
)

func GetHealthConfigAnnotation() []AnotationKey {
	return []AnotationKey{RateHealthAnnotation}
}

func GetHealthAnnotation(annotations map[string]string, filters []AnotationKey) interface{} {
	var result = map[string]string{}
	for _, filter := range filters {
		if filter == AllHealthAnnotation {
			return annotations
		}
		if annotation, ok := annotations[string(filter)]; ok {
			result[string(filter)] = annotation
		}
	}
	return result
}
