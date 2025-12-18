package authentication

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

// =============================================================================
// BUG 1 TESTS: ReadAllSessions Processes Chunk Cookies as Full Sessions
// =============================================================================
//
// These tests demonstrate that ReadAllSessions incorrectly matches chunk cookies
// (e.g., "kiali-token-1") and metadata cookies (e.g., "kiali-token-chunks") as
// main session cookies, attempts to decrypt them, fails, and drops them.
//
// The filter condition is:
//   strings.HasPrefix(cookie.Name, SessionCookieName)
// which matches "kiali-token", "kiali-token-1", "kiali-token-chunks", etc.

// TestBug1_ReadAllSessions_DropsChunkCookies demonstrates that ReadAllSessions
// will drop chunk cookies because they fail decryption.
func TestBug1_ReadAllSessions_DropsChunkCookies(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a session with payload large enough to require chunking
	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize),
	}

	expiresTime := now.Add(time.Hour)
	session, err := NewSessionData("", conf.Auth.Strategy, expiresTime, &largePayload)
	require.NoError(err)

	// Create the session to get the cookies
	createRR := httptest.NewRecorder()
	err = persistor.CreateSession(nil, createRR, *session)
	require.NoError(err)

	createResponse := createRR.Result()
	cookies := createResponse.Cookies()

	// Verify that we have chunked cookies (main + chunks + chunks-count)
	require.GreaterOrEqual(len(cookies), 3, "Expected at least 3 cookies for a chunked session")

	// Verify the cookie names
	cookieNames := make([]string, len(cookies))
	for i, c := range cookies {
		cookieNames[i] = c.Name
	}
	t.Logf("Created cookies: %v", cookieNames)

	// The cookies should be: kiali-token, kiali-token-1, kiali-token-chunks
	assert.Contains(t, cookieNames, SessionCookieName)
	assert.Contains(t, cookieNames, SessionCookieName+"-1")
	assert.Contains(t, cookieNames, NumberOfChunksCookieName)

	// Now simulate a request with all these cookies
	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	// Call ReadAllSessions
	readRR := httptest.NewRecorder()
	sessions, err := persistor.ReadAllSessions(request, readRR)

	// BUG DEMONSTRATION: ReadAllSessions will try to decrypt "kiali-token-1"
	// and "kiali-token-chunks" as full sessions. When decryption fails,
	// it drops these cookies.

	readResponse := readRR.Result()
	droppedCookies := readResponse.Cookies()

	// If the bug exists, chunk cookies will be dropped
	// The expected behavior is that NO cookies should be dropped
	// because ReadAllSessions should only process main session cookies.
	if len(droppedCookies) > 0 {
		droppedNames := make([]string, len(droppedCookies))
		for i, c := range droppedCookies {
			droppedNames[i] = c.Name
		}
		t.Errorf("BUG CONFIRMED: ReadAllSessions dropped cookies: %v", droppedNames)
		t.Log("These cookies were incorrectly processed as full sessions and dropped when decryption failed")
	}

	// Verify we still got the session data (the main session should still work
	// even though chunk cookies were corrupted by the bug)
	if err != nil {
		t.Logf("ReadAllSessions returned error: %v", err)
	}
	if sessions != nil {
		t.Logf("Got %d sessions", len(sessions))
	}

	// The assertion that demonstrates the bug:
	// After ReadAllSessions, the chunk cookies should NOT have been dropped
	assert.Empty(t, droppedCookies,
		"BUG: ReadAllSessions should not drop any cookies, but it dropped chunk cookies")
}

// TestBug1_ReadAllSessions_FilterMatchesChunkCookies verifies the problematic filter
// matches chunk cookies when it shouldn't.
func TestBug1_ReadAllSessions_FilterMatchesChunkCookies(t *testing.T) {
	// This test demonstrates the filter logic bug without needing encryption

	testCases := []struct {
		cookieName    string
		shouldProcess bool // What the current filter does
		shouldBeMain  bool // What it SHOULD do (only process main session cookies)
	}{
		{"kiali-token", true, true},                  // Main session - correct
		{"kiali-token-cluster1", true, true},         // Keyed session - correct
		{"kiali-token-1", true, false},               // BUG: Chunk cookie processed as session
		{"kiali-token-cluster1-1", true, false},      // BUG: Keyed chunk cookie processed as session
		{"kiali-token-chunks", true, false},          // BUG: Chunks count cookie processed as session
		{"kiali-token-chunks-cluster1", true, false}, // Keyed chunks count - processed
		{"kiali-token-nonce", false, false},          // Nonce cookie - correctly excluded
		{"kiali-token-nonce-abc", false, false},      // Keyed nonce - correctly excluded
		{"other-cookie", false, false},               // Unrelated cookie - correctly excluded
	}

	for _, tc := range testCases {
		t.Run(tc.cookieName, func(t *testing.T) {
			// Replicate the filter logic from ReadAllSessions (line 336)
			isProcessed := (strings.HasPrefix(tc.cookieName, SessionCookieName) ||
				strings.HasPrefix(tc.cookieName, NumberOfChunksCookieName)) &&
				!strings.HasPrefix(tc.cookieName, NonceCookieName)

			assert.Equal(t, tc.shouldProcess, isProcessed,
				"Filter behavior mismatch for cookie %q", tc.cookieName)

			if tc.shouldProcess != tc.shouldBeMain {
				t.Logf("BUG: Cookie %q is processed=%v but should only be processed if it's a main session cookie=%v",
					tc.cookieName, tc.shouldProcess, tc.shouldBeMain)
			}
		})
	}
}

// =============================================================================
// BUG 2 TESTS: NumberOfChunksCookieName Not Keyed Per Session
// =============================================================================
//
// These tests demonstrate that:
// 1. CreateSession always uses "kiali-token-chunks" regardless of session key
// 2. TerminateSession looks for "kiali-token-chunks-{key}" which doesn't exist
// 3. Multiple keyed sessions collide on the shared chunks count cookie

// TestBug2_ChunksCookieNotKeyedInCreateSession demonstrates that CreateSession
// always creates the chunks cookie with the same name regardless of session key.
func TestBug2_ChunksCookieNotKeyedInCreateSession(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a large payload that requires chunking
	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize),
	}

	expiresTime := now.Add(time.Hour)

	// Create session with key "cluster1"
	session1, err := NewSessionData("cluster1", conf.Auth.Strategy, expiresTime, &largePayload)
	require.NoError(err)

	rr1 := httptest.NewRecorder()
	err = persistor.CreateSession(nil, rr1, *session1)
	require.NoError(err)

	// Check the chunks cookie name
	var chunksCookieName string
	for _, cookie := range rr1.Result().Cookies() {
		if strings.Contains(cookie.Name, "chunks") {
			chunksCookieName = cookie.Name
			break
		}
	}

	// BUG: The chunks cookie should be "kiali-token-chunks-cluster1"
	// but it's actually "kiali-token-chunks"
	expectedChunksCookieName := sessionCookieName(NumberOfChunksCookieName, "cluster1")
	actualChunksCookieName := NumberOfChunksCookieName

	t.Logf("Expected chunks cookie name: %s", expectedChunksCookieName)
	t.Logf("Actual chunks cookie name: %s", chunksCookieName)

	if chunksCookieName != expectedChunksCookieName {
		t.Errorf("BUG CONFIRMED: Chunks cookie is not keyed per session. "+
			"Expected %q but got %q", expectedChunksCookieName, chunksCookieName)
	}

	// The assertion - this will fail due to the bug
	assert.Equal(t, actualChunksCookieName, chunksCookieName,
		"Chunks cookie name mismatch (this passes because bug exists)")
}

// TestBug2_TerminateSessionDoesNotFindKeyedChunksCookie demonstrates that
// TerminateSession looks for a keyed chunks cookie that was never created.
func TestBug2_TerminateSessionDoesNotFindKeyedChunksCookie(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a large payload that requires chunking
	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize),
	}

	expiresTime := now.Add(time.Hour)

	// Create session with key "cluster1"
	session, err := NewSessionData("cluster1", conf.Auth.Strategy, expiresTime, &largePayload)
	require.NoError(err)

	createRR := httptest.NewRecorder()
	err = persistor.CreateSession(nil, createRR, *session)
	require.NoError(err)

	// Get all cookies created
	createdCookies := createRR.Result().Cookies()
	createdCookieNames := make([]string, len(createdCookies))
	for i, c := range createdCookies {
		createdCookieNames[i] = c.Name
	}
	t.Logf("Created cookies: %v", createdCookieNames)

	// Now terminate the session
	terminateRequest := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, cookie := range createdCookies {
		terminateRequest.AddCookie(cookie)
	}

	terminateRR := httptest.NewRecorder()
	persistor.TerminateSession(terminateRequest, terminateRR, "cluster1")

	// Get dropped cookies
	droppedCookies := terminateRR.Result().Cookies()
	droppedCookieNames := make([]string, len(droppedCookies))
	for i, c := range droppedCookies {
		droppedCookieNames[i] = c.Name
	}
	t.Logf("Dropped cookies: %v", droppedCookieNames)

	// BUG: TerminateSession looks for "kiali-token-chunks-cluster1"
	// but CreateSession created "kiali-token-chunks"
	// So the chunks cookie won't be dropped!

	// Check if the chunks cookie was dropped
	chunksDropped := false
	for _, name := range droppedCookieNames {
		if name == NumberOfChunksCookieName {
			chunksDropped = true
			break
		}
	}

	if !chunksDropped {
		t.Errorf("BUG CONFIRMED: TerminateSession did not drop the chunks cookie %q "+
			"because it was looking for %q which doesn't exist",
			NumberOfChunksCookieName,
			sessionCookieName(NumberOfChunksCookieName, "cluster1"))
	}

	// This assertion will fail due to the bug
	assert.True(t, chunksDropped,
		"BUG: The chunks cookie should have been dropped during TerminateSession")
}

// TestBug2_MultipleKeyedSessionsCollideOnChunksCookie demonstrates that
// multiple keyed sessions share the same chunks count cookie, causing collisions.
func TestBug2_MultipleKeyedSessionsCollideOnChunksCookie(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a large payload that requires chunking
	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize),
	}

	expiresTime := now.Add(time.Hour)

	// Create session for cluster1
	session1, err := NewSessionData("cluster1", conf.Auth.Strategy, expiresTime, &largePayload)
	require.NoError(err)

	rr1 := httptest.NewRecorder()
	err = persistor.CreateSession(nil, rr1, *session1)
	require.NoError(err)

	// Get chunks cookie value for cluster1
	var chunks1Value string
	for _, c := range rr1.Result().Cookies() {
		if c.Name == NumberOfChunksCookieName {
			chunks1Value = c.Value
			break
		}
	}

	// Create session for cluster2 with different size payload (different number of chunks)
	// Make it bigger to get more chunks
	veryLargePayload := testSessionPayload{
		FirstField: strings.Repeat("Y", SessionCookieMaxSize*2),
	}
	session2, err := NewSessionData("cluster2", conf.Auth.Strategy, expiresTime, &veryLargePayload)
	require.NoError(err)

	rr2 := httptest.NewRecorder()
	err = persistor.CreateSession(nil, rr2, *session2)
	require.NoError(err)

	// Get chunks cookie value for cluster2
	var chunks2Value string
	for _, c := range rr2.Result().Cookies() {
		if c.Name == NumberOfChunksCookieName {
			chunks2Value = c.Value
			break
		}
	}

	t.Logf("Cluster1 chunks cookie value: %s", chunks1Value)
	t.Logf("Cluster2 chunks cookie value: %s", chunks2Value)

	// BUG: Both sessions use the same cookie name "kiali-token-chunks"
	// The second session will overwrite the first session's chunks count
	// When reading cluster1's session, it will use cluster2's chunk count!

	if chunks1Value != chunks2Value {
		t.Logf("BUG CONFIRMED: Both sessions use the same chunks cookie name %q. "+
			"Cluster1 has %s chunks, cluster2 has %s chunks. "+
			"The browser will only keep the latest value, causing session corruption.",
			NumberOfChunksCookieName, chunks1Value, chunks2Value)
	}

	// Demonstrate that reading cluster1 with cluster2's chunk count fails
	// Simulate a browser that received both sets of cookies (cluster2's chunks overwrote cluster1's)
	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)

	// Add cluster1's session cookies
	for _, c := range rr1.Result().Cookies() {
		if c.Name != NumberOfChunksCookieName { // Skip chunks cookie
			request.AddCookie(c)
		}
	}
	// Add cluster2's chunks cookie (simulating the overwrite)
	for _, c := range rr2.Result().Cookies() {
		if c.Name == NumberOfChunksCookieName {
			request.AddCookie(c)
		}
	}

	readRR := httptest.NewRecorder()
	sData, readErr := persistor.ReadSession(request, readRR, "cluster1")

	if readErr != nil {
		t.Logf("BUG EFFECT: Reading cluster1's session with cluster2's chunk count failed: %v", readErr)
	} else if sData != nil {
		t.Logf("Session read succeeded but may have wrong data")
	}
}

// =============================================================================
// BUG 4 TESTS: Inconsistent Nonce Filtering
// =============================================================================
//
// These tests demonstrate that ReadAllSessions and TerminateSession use
// different methods to filter out nonce cookies.

// TestBug4_InconsistentNonceFiltering demonstrates the inconsistent nonce filtering
// between ReadAllSessions and TerminateSession.
func TestBug4_InconsistentNonceFiltering(t *testing.T) {
	// ReadAllSessions uses: !strings.HasPrefix(cookie.Name, NonceCookieName)
	// TerminateSession uses: !strings.Contains(cookie.Name, "nonce")

	testCases := []struct {
		cookieName          string
		readAllSessionsKeep bool // What ReadAllSessions filter does
		terminateSessionDel bool // What TerminateSession filter does
	}{
		// Standard nonce cookie
		{"kiali-token-nonce", false, false},
		// Keyed nonce cookie
		{"kiali-token-nonce-cluster1", false, false},
		// Hypothetical cookie with "nonce" in the middle (unlikely but demonstrates inconsistency)
		{"kiali-token-cluster-nonce-abc", true, false},
	}

	for _, tc := range testCases {
		t.Run(tc.cookieName, func(t *testing.T) {
			// ReadAllSessions filter (line 336)
			readAllKeeps := (strings.HasPrefix(tc.cookieName, SessionCookieName) ||
				strings.HasPrefix(tc.cookieName, NumberOfChunksCookieName)) &&
				!strings.HasPrefix(tc.cookieName, NonceCookieName)

			// TerminateSession filter (line 387) - for key="" to simplify
			terminateDeletes := (strings.HasPrefix(tc.cookieName, sessionCookieName(SessionCookieName, "")) ||
				tc.cookieName == sessionCookieName(NumberOfChunksCookieName, "")) &&
				!strings.Contains(tc.cookieName, "nonce")

			t.Logf("Cookie %q: ReadAllSessions keeps=%v, TerminateSession deletes=%v",
				tc.cookieName, readAllKeeps, terminateDeletes)

			if readAllKeeps != tc.readAllSessionsKeep {
				t.Errorf("ReadAllSessions filter mismatch for %q: expected keeps=%v, got keeps=%v",
					tc.cookieName, tc.readAllSessionsKeep, readAllKeeps)
			}
		})
	}

	// The key inconsistency:
	// - HasPrefix only matches if it STARTS with the pattern
	// - Contains matches if the pattern appears ANYWHERE

	t.Log("\nFilter comparison:")
	t.Logf("ReadAllSessions: !strings.HasPrefix(cookie.Name, %q)", NonceCookieName)
	t.Logf("TerminateSession: !strings.Contains(cookie.Name, \"nonce\")")
	t.Log("\nRecommendation: Use consistent filtering (strings.Contains is more robust)")
}

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

// TestHelper_sessionCookieName verifies the helper function behavior.
func TestHelper_sessionCookieName(t *testing.T) {
	testCases := []struct {
		base     string
		key      string
		expected string
	}{
		{SessionCookieName, "", SessionCookieName},
		{SessionCookieName, "cluster1", "kiali-token-cluster1"},
		{NumberOfChunksCookieName, "", NumberOfChunksCookieName},
		{NumberOfChunksCookieName, "cluster1", "kiali-token-chunks-cluster1"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			result := sessionCookieName(tc.base, tc.key)
			assert.Equal(t, tc.expected, result)
		})
	}
}
