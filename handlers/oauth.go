package handlers

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

// Returns the configuration from Openshift for oAuth, or 500 if not on Openshift
func OAuthMetadata(w http.ResponseWriter, r *http.Request) {
	if !config.Get().OAuth.Enabled {
		err := fmt.Errorf("OAuth is not enabled for this deployment")

		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return
	}

	business, err := business.Get()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return
	}

	metadata, err := business.OpenshiftOAuth.Metadata()
	fmt.Printf("%s\n", err)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, metadata)
}
