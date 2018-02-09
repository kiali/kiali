package handlers

import (
	"fmt"
	"net/http"

	"github.com/swift-sunshine/swscore/log"
)

func Root(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Welcome to SWS API Server!\n")
	log.Info("ROOT HANDLER CALLED!")
}
