package store

// Store is a generic key value store. Implementations should be safe for concurrent use.
// It is basically just a map with a lock. Does not yet implement Set so we don't have to
// worry about this thing growing without bound.
type Store[T any] interface {
	// Get returns the value associated with the given key. Returns false if key was not found.
	Get(key string) (T, bool)
	// Keys returns all the keys in the store.
	Keys() []string
	// Remove removes the given key from the store. If the key does not exist, it does nothing.
	Remove(key string)
	// Replace replaces the contents of the store with the given map.
	Replace(map[string]T)
	// Set associates the given value with the given key. It will overwrite any existing value
	// or create a new entry if the key does not exist.
	Set(key string, value T)
}

// New returns a new store safe for concurrent use.
func New[T any]() Store[T] {
	return &threadSafeStore[T]{data: make(map[string]T)}
}
