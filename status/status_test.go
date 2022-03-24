package status

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
)

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
