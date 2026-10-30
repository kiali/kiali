package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
)

func TestHandleErrorResponseStatusMapping(t *testing.T) {
	gr := schema.GroupResource{Group: "", Resource: "namespaces"}

	cases := []struct {
		name     string
		err      error
		expected int
	}{
		{"accessible namespace error maps to 403", business.NewAccessibleNamespaceError("not accessible"), http.StatusForbidden},
		{"k8s not found maps to 404", k8serrors.NewNotFound(gr, "ns"), http.StatusNotFound},
		{"k8s forbidden maps to 403", k8serrors.NewForbidden(gr, "ns", nil), http.StatusForbidden},
		{"k8s unauthorized stays 500", k8serrors.NewUnauthorized("unauthorized"), http.StatusInternalServerError},
		{"plain error maps to 500", assert.AnError, http.StatusInternalServerError},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handleErrorResponse(rec, c.err)
			require.Equal(t, c.expected, rec.Code, rec.Body.String())
		})
	}
}
