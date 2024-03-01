package util

// AsPtr returns a pointer to the argument.
func AsPtr[T any](t T) *T {
	return &t
}
