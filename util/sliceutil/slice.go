package sliceutil

// Filter returns a new slice with all the elements that satisfy the predicate.
func Filter[S ~[]E, E any](slice S, f func(E) bool) []E {
	if slice == nil {
		return nil
	}

	ret := []E{}
	for _, e := range slice {
		if f(e) {
			ret = append(ret, e)
		}
	}
	return ret
}

// Map returns a new slice with the results of applying the function to each element.
func Map[S ~[]E, E any, T any](slice S, f func(E) T) []T {
	if slice == nil {
		return nil
	}

	ret := []T{}
	for _, e := range slice {
		ret = append(ret, f(e))
	}
	return ret
}

// Some returns true if any of the elements satisfies the predicate, otherwise false
func Some[S ~[]E, E any](slice S, f func(E) bool) bool {
	if slice == nil {
		return false
	}

	for _, e := range slice {
		if f(e) {
			return true
		}
	}
	return false
}

// Find returns first element matching the predicate, otherwise nil
func Find[S ~[]E, E any](slice S, f func(E) bool) *E {
	if slice == nil {
		return nil
	}

	for _, e := range slice {
		if f(e) {
			return &e
		}
	}
	return nil
}
