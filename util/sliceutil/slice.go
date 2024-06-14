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
