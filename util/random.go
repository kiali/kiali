package util

import (
	cryptoRand "crypto/rand"
	mathRand "math/rand"
)

// RandomString generates a random string of length n. Before calling this function, you should call
// rand.Seed() to initialize the default source.
//
// Found at https://ispycode.com/Blog/golang/2016-10/How-to-generate-a-random-string-of-a-fixed-length
// - Adapted for more characters
func RandomString(n int) string {
	var letterRunes = []rune("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-!@#$%^&*()")

	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[mathRand.Intn(len(letterRunes))]
	}
	return string(b)
}

// CryptoRandomBytes returns securely generated random bytes.
// It will return an error if the system's secure random
// number generator fails to function correctly, in which
// case the caller should not continue.
//
// Found at https://gist.github.com/dopey/c69559607800d2f2f90b1b1ed4e550fb
func CryptoRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := cryptoRand.Read(b)
	// Note that err == nil only if we read len(b) bytes.
	if err != nil {
		return nil, err
	}

	return b, nil
}

// CryptoRandomString returns a securely generated random string.
// It will return an error if the system's secure random
// number generator fails to function correctly, in which
// case the caller should not continue.
//
// Found at https://gist.github.com/dopey/c69559607800d2f2f90b1b1ed4e550fb
func CryptoRandomString(n int) (string, error) {
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-!@#$%^&*()"
	bytes, err := CryptoRandomBytes(n)
	if err != nil {
		return "", err
	}
	for i, b := range bytes {
		bytes[i] = letters[b%byte(len(letters))]
	}
	return string(bytes), nil
}
