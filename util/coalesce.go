package util

// CoalesceErrors returns the first non-nil error
func CoalesceErrors(args ...error) error {
	for _, obj := range args {
		if obj != nil {
			return obj
		}
	}
	return nil
}
