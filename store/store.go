package store

// Store is a generic key value store. Implementations should be safe for concurrent use.
// It is basically just a map with a lock.
type Store[K comparable, V any] interface {
	// Get returns the value associated with the given key. Returns false if key was not found.
	Get(key K) (V, bool)

	// Items returns the store's contents.
	Items() map[K]V

	// Keys returns all the keys in the store.
	Keys() []K

	// Remove removes the given key from the store. If the key does not exist, it does nothing.
	Remove(key K)

	// Replace replaces the contents of the store with the given map.
	Replace(map[K]V)

	// Set associates the given value with the given key. It will overwrite any existing value
	// or create a new entry if the key does not exist.
	Set(key K, value V)
}

// New returns a new store safe for concurrent use.
func New[K comparable, V any]() Store[K, V] {
	return &threadSafeStore[K, V]{data: make(map[K]V)}
}
