package handlers

import (
	"github.com/kiali/kiali/config"
	"github.com/stretchr/testify/assert"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestLogoutWhenNoSession checks that the Logout handler
// returns a blank response with no cookies being set when the
// user is not logged in.
func TestLogoutWhenNoSession(t *testing.T) {
	request := httptest.NewRequest("GET", "http://kiali/api/logout", nil)
	responseRecorder := httptest.NewRecorder()
	Logout(responseRecorder, request)

	response := responseRecorder.Result()
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Zero(t, len(response.Cookies()))
}

// TestLogout checks that the Logout handler
// sets a blank cookie to terminate the user's session
func TestLogout(t *testing.T) {
	request := httptest.NewRequest("GET", "http://kiali/api/logout", nil)
	request.AddCookie(&http.Cookie{
		Name:  config.TokenCookieName,
		Value: "foo",
	})

	responseRecorder := httptest.NewRecorder()
	Logout(responseRecorder, request)

	response := responseRecorder.Result()
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Equal(t, 1, len(response.Cookies()))

	cookieSet := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookieSet.Name)
	assert.Equal(t, "", cookieSet.Value)
	assert.True(t, cookieSet.Expires.Before(time.Now()))

}
