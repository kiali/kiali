package intutil

import "errors"

func Convert(subject interface{}) (int, error) {
	var result int

	switch typedSubject := subject.(type) {
	case uint64:
		result = int(typedSubject)
	case int64:
		result = int(typedSubject)
	case int32:
		result = int(typedSubject)
	case uint32:
		result = int(typedSubject)
	case int:
		result = typedSubject
	default:
		return 0, errors.New("it is not a numeric input")
	}

	return result, nil
}
