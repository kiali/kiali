package util

import "math/rand"

// RandomString generates a random string of length n. Before calling this function, you should call
// rand.Seed() to initialize the default source.
//
// Found at https://ispycode.com/Blog/golang/2016-10/How-to-generate-a-random-string-of-a-fixed-length
func RandomString(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}
