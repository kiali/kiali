package intutil

import "errors"

func Convert(subject interface{}) (int, error) {
	switch s := subject.(type) {
	case uint64:
		return int(s), nil
	case int64:
		return int(s), nil
	case int:
		return s, nil
	default:
		return 0, errors.New("It is not a numeric input")
	}
}
