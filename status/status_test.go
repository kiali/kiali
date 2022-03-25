package status

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
)

// test multiple goroutines to write the same key with different values
func TestMultiplePutStatus(t *testing.T) {
	counter := 100
	wg := sync.WaitGroup{}

	wg.Add(counter)
	// write different values with the same key
	for i := 0; i < counter; i++ {
		k, v := "key", fmt.Sprintf("%d", rand.Intn(1000000))
		go func(k, v string) {
			Put(k, v)
			wg.Done()
		}(k, v)
	}
	wg.Wait()
}

// test multiple goroutines to read the key while writing the same key with different values
func TestMultipleGetStatus(t *testing.T) {
	counter := 100
	wg := sync.WaitGroup{}

	wg.Add(counter)
	// get status while writing different values with the same key
	for i := 0; i < counter; i++ {
		k, v := "key", fmt.Sprintf("%d", rand.Intn(1000000))
		go func(k, v string) {
			Put(k, v)
			GetStatus(k)
			wg.Done()
		}(k, v)
	}
	wg.Wait()
}
