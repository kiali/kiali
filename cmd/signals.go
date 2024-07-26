package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/kiali/kiali/log"
)

// WaitForTermination waits for TERM signals to call the cancel func.
func WaitForTermination(cancel context.CancelFunc) {
	doneChan := make(chan bool)

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-signalChan
		log.Infof("Termination Signal %s Received", sig.String())
		cancel()
		doneChan <- true
	}()

	<-doneChan
}
