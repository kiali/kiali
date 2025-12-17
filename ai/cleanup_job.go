package ai

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/log"
)

// CleanupJob manages periodic cleanup of inactive AI chat conversations.
// It runs on a ticker and removes sessions that haven't been accessed
// for longer than the configured InactivityTimeout.
type CleanupJob struct {
	aiStore       *AIStoreImpl
	cancel        context.CancelFunc
	ctx           context.Context
	mu            sync.Mutex
	checkInterval time.Duration // How often to check for inactive sessions
	stopChan      chan struct{}
	stopped       bool
	ticker        *time.Ticker
}

// NewCleanupJob creates a new cleanup job for the AI store.
// checkInterval determines how often to check for inactive sessions.
// A reasonable default is 5 minutes or InactivityTimeout / 4, whichever is smaller.
func NewCleanupJob(ctx context.Context, aiStore *AIStoreImpl, checkInterval time.Duration) *CleanupJob {
	jobCtx, cancel := context.WithCancel(ctx)

	return &CleanupJob{
		aiStore:       aiStore,
		cancel:        cancel,
		ctx:           jobCtx,
		checkInterval: checkInterval,
		stopChan:      make(chan struct{}),
		stopped:       false,
	}
}

// Start begins the background cleanup loop.
// This method blocks until Stop() is called or the context is cancelled.
func (j *CleanupJob) Start() {
	j.mu.Lock()
	if j.stopped {
		j.mu.Unlock()
		return
	}

	// Create ticker for periodic checks
	j.ticker = time.NewTicker(j.checkInterval)
	j.mu.Unlock()

	log.Debugf("Starting AI store cleanup job (check interval: %v, inactivity timeout: %v)",
		j.checkInterval, j.aiStore.config.InactivityTimeout)

	// Do an initial check after a short delay
	firstTimer := time.NewTimer(time.Minute)
	defer firstTimer.Stop()

	select {
	case <-firstTimer.C:
		go j.cleanup()
	case <-j.stopChan:
		log.Debugf("Stopping AI store cleanup job before first check")
		j.cleanupResources()
		return
	case <-j.ctx.Done():
		log.Debugf("Context cancelled for AI store cleanup job before first check")
		j.cleanupResources()
		return
	}

	for {
		// Capture ticker channel with proper synchronization
		j.mu.Lock()
		tickerChan := j.ticker.C
		j.mu.Unlock()

		select {
		case <-tickerChan:
			go j.cleanup()
		case <-j.stopChan:
			log.Debugf("Stopping AI store cleanup job")
			j.cleanupResources()
			return
		case <-j.ctx.Done():
			log.Debugf("Context cancelled for AI store cleanup job")
			j.cleanupResources()
			return
		}
	}
}

// Stop halts the cleanup job.
func (j *CleanupJob) Stop() {
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.stopped {
		return
	}

	j.stopped = true
	close(j.stopChan)
	j.cancel()
	j.cleanupResources()
}

// cleanupResources performs cleanup when the job stops.
func (j *CleanupJob) cleanupResources() {
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.ticker != nil {
		j.ticker.Stop()
	}
	j.stopped = true
}

// cleanup performs a single cleanup cycle.
// It checks all sessions and removes those that haven't been accessed
// for longer than the InactivityTimeout.
func (j *CleanupJob) cleanup() {
	if !j.aiStore.config.Enabled {
		return
	}

	j.aiStore.mu.RLock()
	// Create a copy of session IDs to avoid holding the lock during cleanup
	sessionIDs := make([]string, 0, len(j.aiStore.conversations))
	for sessionID := range j.aiStore.conversations {
		sessionIDs = append(sessionIDs, sessionID)
	}
	j.aiStore.mu.RUnlock()

	now := time.Now()
	removedCount := 0
	inactivityTimeout := j.aiStore.config.InactivityTimeout

	for _, sessionID := range sessionIDs {
		j.aiStore.mu.RLock()
		sessionConversation, exists := j.aiStore.conversations[sessionID]
		if !exists {
			j.aiStore.mu.RUnlock()
			continue
		}

		// Check last accessed time
		sessionConversation.mu.RLock()
		lastAccessed := sessionConversation.LastAccessed
		sessionConversation.mu.RUnlock()
		j.aiStore.mu.RUnlock()

		inactiveDuration := now.Sub(lastAccessed)
		if inactiveDuration > inactivityTimeout {
			log.Debugf("Session [%s] inactive for %v (timeout: %v), removing from AI store",
				sessionID, inactiveDuration.Round(time.Minute), inactivityTimeout)

			// Remove the entire session (which removes all conversations in that session)
			j.aiStore.mu.Lock()
			delete(j.aiStore.conversations, sessionID)
			j.aiStore.mu.Unlock()

			removedCount++
		}
	}

	if removedCount > 0 {
		log.Infof("AI store cleanup: removed %d inactive session(s)", removedCount)
	} else {
		log.Tracef("AI store cleanup: no inactive sessions found")
	}
}
