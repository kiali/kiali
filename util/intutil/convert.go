package intutil

import "errors"

func Convert(subject interface{}) (int, error) {
	var result int

	switch subject.(type) {
	case uint64:
		result = int(subject.(uint64))
	case int64:
		result = int(subject.(int64))
	case int32:
		result = int(subject.(int32))
	case uint32:
		result = int(subject.(uint32))
	case int:
		result = subject.(int)
	default:
		return 0, errors.New("it is not a numeric input")
	}

	return result, nil
}
