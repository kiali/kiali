package models

// Annotationkey is a mnemonic type name for string
type AnnotationKey string

const (
	AllHealthAnnotation  AnnotationKey = ".*"
	RateHealthAnnotation AnnotationKey = "health.kiali.io/rate"
)

func GetHealthConfigAnnotation() []AnnotationKey {
	return []AnnotationKey{RateHealthAnnotation}
}

func GetHealthAnnotation(annotations map[string]string, filters []AnnotationKey) map[string]string {
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
