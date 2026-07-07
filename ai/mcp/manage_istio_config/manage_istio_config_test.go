package manage_istio_config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istio_api_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	api_errors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestMain(m *testing.M) {
	// The fake Istio clientset and the fake kubeCache are separate stores,
	// so the cache-wait polls always time out (5s each, 9 tests = 45s).
	// Shortcutting the timeout keeps the tests fast.
	kubernetes.CacheWaitTimeout = 1 * time.Millisecond
	os.Exit(m.Run())
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func setupTest(t *testing.T, objs ...runtime.Object) (*business.Layer, *config.Config) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	runtimeObjs := make([]runtime.Object, 0, len(objs)+1)
	runtimeObjs = append(runtimeObjs, kubetest.FakeNamespace("bookinfo"))
	runtimeObjs = append(runtimeObjs, objs...)
	k8s := kubetest.NewFakeK8sClient(runtimeObjs...)
	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build(), conf
}

func reqWithAuth() *http.Request {
	r := httptest.NewRequest("POST", "http://kiali/api/ai/mcp/manage_istio_config", nil)
	r.Header.Set("Kiali-User", "test-user")
	return r
}

func kialiIntf(r *http.Request, businessLayer *business.Layer, conf *config.Config) *mcputil.KialiInterface {
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Conf:          conf,
	}
}

func kialiIntfWithFactory(r *http.Request, businessLayer *business.Layer, conf *config.Config, cf kubernetes.ClientFactory) *mcputil.KialiInterface {
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Conf:          conf,
		ClientFactory: cf,
	}
}

func existingVS() *networking_v1.VirtualService {
	return &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.VirtualService{
			Hosts: []string{"reviews"},
		},
	}
}

func existingDR() *networking_v1.DestinationRule {
	return &networking_v1.DestinationRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews-dr",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.DestinationRule{
			Host: "reviews",
		},
	}
}

func baseWriteArgs(action string) map[string]interface{} {
	return map[string]interface{}{
		"action":    action,
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}
}

// previewResponse is the shape returned when confirmed=false or for write actions with actions payload.
type previewResponse struct {
	Actions []get_action_ui.Action `json:"actions"`
	Result  interface{}            `json:"result"`
}

// ---------------------------------------------------------------------------
// 1. Schema / input validation tests
// ---------------------------------------------------------------------------

func TestValidateIstioConfigInput(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name:    "invalid action",
			args:    map[string]interface{}{"action": "invalid"},
			wantErr: "invalid action",
		},
		{
			name:    "create missing namespace",
			args:    map[string]interface{}{"action": "create", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "namespace is required",
		},
		{
			name:    "create missing group",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "group is required",
		},
		{
			name:    "create missing version",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "version is required",
		},
		{
			name:    "create missing kind",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "object": "x", "data": "{}"},
			wantErr: "kind is required",
		},
		{
			name:    "create missing data",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "data is required",
		},
		{
			name:    "create missing object",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "data": "{}"},
			wantErr: "object (resource name) is required",
		},
		{
			name:    "patch missing object",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "data": "{}"},
			wantErr: "object (resource name) is required",
		},
		{
			name:    "patch missing data",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "data is required",
		},
		{
			name:    "delete missing object",
			args:    map[string]interface{}{"action": "delete", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService"},
			wantErr: "object (resource name) is required",
		},
		{
			name: "valid create",
			args: map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
		},
		{
			name: "valid patch",
			args: map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
		},
		{
			name: "valid delete",
			args: map[string]interface{}{"action": "delete", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
		},
		{
			name:    "create invalid kind for networking",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "WasmPlugin", "object": "x", "data": "{}"},
			wantErr: "invalid kind",
		},
		{
			name:    "patch invalid kind for security",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "security.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "invalid kind",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateIstioConfigInput(tt.args)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateReadOnlyIstioConfigInput(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name: "list with no args is valid",
			args: map[string]interface{}{"action": "list"},
		},
		{
			name:    "get missing namespace",
			args:    map[string]interface{}{"action": "get", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "namespace is required",
		},
		{
			name:    "get missing group",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "group is required",
		},
		{
			name:    "get missing version",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "kind": "VirtualService", "object": "x"},
			wantErr: "version is required",
		},
		{
			name:    "get missing kind",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "object": "x"},
			wantErr: "kind is required",
		},
		{
			name:    "get missing object",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService"},
			wantErr: "name is required",
		},
		{
			name:    "invalid action for read-only",
			args:    map[string]interface{}{"action": "create"},
			wantErr: "invalid action",
		},
		{
			name: "valid get networking",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
		},
		{
			name: "valid get gateway API",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "gateway.networking.k8s.io", "version": "v1", "kind": "HTTPRoute", "object": "bookinfo"},
		},
		{
			name: "valid get extensions",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "extensions.istio.io", "version": "v1alpha1", "kind": "WasmPlugin", "object": "x"},
		},
		{
			name: "list filter kind without group infers networking",
			args: map[string]interface{}{"action": "list", "kind": "VirtualService"},
		},
		{
			name: "list filter Gateway kind without group infers Istio when GW API disabled",
			args: map[string]interface{}{"action": "list", "kind": "Gateway"},
		},
		{
			name:    "list filter group without kind",
			args:    map[string]interface{}{"action": "list", "group": "networking.istio.io"},
			wantErr: "kind is required",
		},
		{
			name: "list filter gateway API group is now valid",
			args: map[string]interface{}{"action": "list", "group": "gateway.networking.k8s.io", "kind": "Gateway"},
		},
		{
			name: "list filter networking",
			args: map[string]interface{}{"action": "list", "group": "networking.istio.io", "kind": "Sidecar"},
		},
		{
			name: "list filter security",
			args: map[string]interface{}{"action": "list", "group": "security.istio.io", "kind": "PeerAuthentication"},
		},
		{
			name: "list filter extensions",
			args: map[string]interface{}{"action": "list", "group": "extensions.istio.io", "kind": "WasmPlugin"},
		},
		{
			name:    "list filter unknown group",
			args:    map[string]interface{}{"action": "list", "group": "unknown.example.com", "kind": "Foo"},
			wantErr: "not a supported Istio or Gateway API group",
		},
		{
			name:    "get unknown group",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "unknown.example.com", "version": "v1", "kind": "Foo", "object": "x"},
			wantErr: "not a supported Istio or Gateway API group",
		},
		{
			name:    "get invalid kind for valid group",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "UnknownKind", "object": "x"},
			wantErr: "invalid kind",
		},
		{
			name: "get telemetry",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "telemetry.istio.io", "version": "v1", "kind": "Telemetry", "object": "x"},
		},
		{
			name: "get inference pool",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "inference.networking.k8s.io", "version": "v1alpha2", "kind": "InferencePool", "object": "x"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReadOnlyIstioConfigInput(tt.args)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateManagedIstioGroupAndKind(t *testing.T) {
	networkingAllowed := []string{
		"VirtualService", "DestinationRule", "Gateway", "ServiceEntry", "Sidecar",
		"WorkloadEntry", "WorkloadGroup", "EnvoyFilter",
	}
	securityAllowed := []string{"AuthorizationPolicy", "PeerAuthentication", "RequestAuthentication"}

	tests := []struct {
		name    string
		group   string
		kind    string
		wantErr string
	}{
		{
			name:  "empty group infers from unambiguous kind",
			group: "",
			kind:  "VirtualService",
		},
		{
			name:  "empty group infers Gateway as Istio when GW API disabled",
			group: "",
			kind:  "Gateway",
		},
		{
			name:    "empty kind",
			group:   "networking.istio.io",
			kind:    "",
			wantErr: "kind is required",
		},
		{
			name:    "unknown group",
			group:   "telemetry.istio.io",
			kind:    "Telemetry",
			wantErr: "invalid group",
		},
		{
			name:    "networking disallowed kind",
			group:   "networking.istio.io",
			kind:    "WasmPlugin",
			wantErr: "invalid kind",
		},
		{
			name:    "security kind used with networking group",
			group:   "networking.istio.io",
			kind:    "AuthorizationPolicy",
			wantErr: "invalid kind",
		},
		{
			name:    "networking kind used with security group",
			group:   "security.istio.io",
			kind:    "VirtualService",
			wantErr: "invalid kind",
		},
		{
			name:    "security disallowed kind",
			group:   "security.istio.io",
			kind:    "WasmPlugin",
			wantErr: "invalid kind",
		},
		{
			name:    "whitespace trimmed networking Gateway",
			group:   "  networking.istio.io  ",
			kind:    " Gateway ",
			wantErr: "",
		},
	}

	for _, k := range networkingAllowed {
		tests = append(tests, struct {
			name    string
			group   string
			kind    string
			wantErr string
		}{name: "networking allowed " + k, group: "networking.istio.io", kind: k})
	}
	for _, k := range securityAllowed {
		tests = append(tests, struct {
			name    string
			group   string
			kind    string
			wantErr string
		}{name: "security allowed " + k, group: "security.istio.io", kind: k})
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateManagedIstioGroupAndKind(tt.group, tt.kind)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 2. Execute – write actions (create, patch, delete)
// ---------------------------------------------------------------------------

func TestExecute_CreateConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1, "should include preview action even on confirmed create")
	assert.Equal(t, "create", resp.Actions[0].Operation)
}

func TestExecute_CreatePreview(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["confirmed"] = false
	args["data"] = `{"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

func TestExecute_PatchConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["data"] = `{"spec":{"hosts":["reviews","ratings"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
}

func TestExecute_PatchPreview(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["confirmed"] = false
	args["data"] = `{"spec":{"hosts":["reviews","ratings"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

func TestExecute_DeleteConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

func TestExecute_DeletePreview(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["confirmed"] = false

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "delete", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

// ---------------------------------------------------------------------------
// 3. Execute – redirects list/get to manage_istio_config_read
// ---------------------------------------------------------------------------

func TestExecute_RejectsListAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "list",
		"confirmed": true,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(string), "manage_istio_config_read")
}

func TestExecute_RejectsGetAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"confirmed": true,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(string), "manage_istio_config_read")
}

// ---------------------------------------------------------------------------
// 4. ExecuteReadOnly tests
// ---------------------------------------------------------------------------

func TestExecuteReadOnly_InvalidAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action": "delete",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	assert.Contains(t, res, "invalid action")
}

func TestExecuteReadOnly_ListSuccess(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS(), existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "list",
		"namespace": "bookinfo",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	result, ok := res.(IstioListResult)
	require.True(t, ok, "expected IstioListResult, got %T", res)
	// Count total resources across all namespaces and GVK groups.
	total := 0
	for _, kinds := range result.Namespaces {
		for _, kvr := range kinds {
			total += len(kvr.Valid) + len(kvr.Invalid)
		}
	}
	assert.GreaterOrEqual(t, total, 2)
}

func TestExecuteReadOnly_GetSuccess(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestExecuteReadOnly_GetNonExistentConfig(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecuteReadOnly_GetNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

// ---------------------------------------------------------------------------
// 5. Corner cases
// ---------------------------------------------------------------------------

func TestExecute_InvalidYAMLData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{invalid yaml:::}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true should attempt the create; the business layer returns the error")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	assert.NotNil(t, resp.Result)
}

func TestExecute_UnmanagedGVK(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "unknown.group",
		"version":   "v1",
		"kind":      "UnknownKind",
		"object":    "test",
		"data":      "{}",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "invalid group")
}

func TestExecuteReadOnly_UnmanagedGVK(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "unknown.group",
		"version":   "v1",
		"kind":      "UnknownKind",
		"object":    "test",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	// Now caught at input validation level: unknown group is rejected before reaching business layer.
	assert.Contains(t, resStr, "not a supported Istio or Gateway API group")
}

// gateway.networking.k8s.io with v1beta1 is not managed; the hint to use v1 should appear.
func TestExecuteReadOnly_GatewayAPIv1beta1Hint(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "gateway.networking.k8s.io",
		"version":   "v1beta1",
		"kind":      "Gateway",
		"object":    "test",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestExecute_DeleteNonExistentResource(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["object"] = "does-not-exist"

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecute_InvalidActionForWrite(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "invalid",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "test",
		"data":      "{}",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "invalid action")
}

func TestExecute_CreateWithYAMLPayload(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	yamlData := `
metadata:
  name: ratings-vs
  namespace: bookinfo
spec:
  hosts:
    - ratings
  http:
    - route:
        - destination:
            host: ratings
`
	args := baseWriteArgs("create")
	args["object"] = "ratings-vs"
	args["data"] = yamlData

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
}

func TestExecute_PatchWithYAMLPayload(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	yamlPatch := `
spec:
  hosts:
    - reviews
    - reviews-v2
`
	args := baseWriteArgs("patch")
	args["data"] = yamlPatch

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
}

func TestExecute_DefaultClusterUsed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	// Deliberately omit "cluster" so the default is used.
	delete(args, "cluster")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

func TestExecute_CreateMissingRequiredField(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchMissingData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_DeleteMissingObject(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	delete(args, "object")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "object (resource name) is required")
}

// ---------------------------------------------------------------------------
// 6. Preview action metadata tests
// ---------------------------------------------------------------------------

func TestCreateFileAction_Metadata(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())

	args := map[string]interface{}{
		"action":      "patch",
		"namespace":   "bookinfo",
		"group":       "networking.istio.io",
		"version":     "v1",
		"kind":        "VirtualService",
		"object":      "reviews",
		"clusterName": "east",
		"data":        `{"spec":{"hosts":["reviews"]}}`,
	}

	actions := createFileAction(reqWithAuth().Context(), args, businessLayer, conf)
	require.Len(t, actions, 1)

	a := actions[0]
	assert.Equal(t, "patch", a.Operation)
	assert.Equal(t, "east", a.Cluster)
	assert.Equal(t, "bookinfo", a.Namespace)
	assert.Equal(t, "networking.istio.io", a.Group)
	assert.Equal(t, "v1", a.Version)
	assert.Equal(t, "VirtualService", a.KindName)
	assert.Equal(t, "reviews", a.Object)
	assert.Equal(t, get_action_ui.ActionKindFile, a.Kind)
	assert.Contains(t, a.FileName, "vs_reviews")
	assert.NotEmpty(t, a.Payload)
}

func TestCreateFileAction_DeleteStubManifest(t *testing.T) {
	businessLayer, conf := setupTest(t)

	args := map[string]interface{}{
		"action":      "delete",
		"namespace":   "bookinfo",
		"group":       "networking.istio.io",
		"version":     "v1",
		"kind":        "VirtualService",
		"object":      "reviews",
		"clusterName": "east",
		"data":        "",
	}

	actions := createFileAction(reqWithAuth().Context(), args, businessLayer, conf)
	require.Len(t, actions, 1)

	a := actions[0]
	assert.Equal(t, "delete", a.Operation)
	assert.Contains(t, a.Payload, "apiVersion")
	assert.Contains(t, a.Payload, "networking.istio.io/v1")
	assert.Contains(t, a.Payload, "reviews")
}

// ---------------------------------------------------------------------------
// 7. IstioCreate / IstioPatch / IstioDelete direct tests
// ---------------------------------------------------------------------------

func TestIstioCreate_ValidJSON(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      `{"metadata":{"name":"new-vs","namespace":"bookinfo"},"spec":{"hosts":["new-svc"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestIstioCreate_InvalidJSON(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      "{",
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Invalid data")
}

func TestIstioCreate_AlreadyExists(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusConflict, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}

func TestIstioCreate_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"data":      "{}",
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestIstioPatch_ValidPatch(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews","ratings"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestIstioPatch_InvalidYAML(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      "{",
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Invalid data")
}

func TestIstioPatch_NonExistent(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestIstioPatch_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"object":    "x",
		"data":      "{}",
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestIstioDelete_Success(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
	assert.Contains(t, resStr, "reviews")
}

func TestIstioDelete_NonExistent(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Resource not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestIstioDelete_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"object":    "x",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

// ---------------------------------------------------------------------------
// 8. normalizeToYAML / stubManifestYAML helpers
// ---------------------------------------------------------------------------

func TestNormalizeToYAML_ValidJSON(t *testing.T) {
	out, err := normalizeToYAML(`{"key":"value"}`)
	require.NoError(t, err)
	assert.Contains(t, out, "key: value")
	assert.True(t, out[len(out)-1] == '\n')
}

func TestNormalizeToYAML_ValidYAML(t *testing.T) {
	out, err := normalizeToYAML("key: value\n")
	require.NoError(t, err)
	assert.Contains(t, out, "key: value")
}

func TestNormalizeToYAML_InvalidInput(t *testing.T) {
	_, err := normalizeToYAML("{")
	assert.Error(t, err)
}

func TestStubManifestYAML(t *testing.T) {
	out := stubManifestYAML("networking.istio.io/v1", "VirtualService", "reviews", "bookinfo")
	assert.Contains(t, out, "apiVersion: networking.istio.io/v1")
	assert.Contains(t, out, "kind: VirtualService")
	assert.Contains(t, out, "name: reviews")
	assert.Contains(t, out, "namespace: bookinfo")
}

// ---------------------------------------------------------------------------
// 9. buildResourceTemplate tests
// ---------------------------------------------------------------------------

func TestBuildResourceTemplate_Gateway(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("Gateway")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-gw", "bookinfo")

	assert.Equal(t, "networking.istio.io/v1", tpl["apiVersion"])
	assert.Equal(t, "Gateway", tpl["kind"])
	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["selector"])
	assert.NotNil(t, spec["servers"])
}

func TestBuildResourceTemplate_VirtualService(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("VirtualService")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-vs", "bookinfo")

	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["hosts"])
	assert.NotNil(t, spec["http"])
}

func TestBuildResourceTemplate_DestinationRule(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("DestinationRule")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-dr", "bookinfo")

	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["host"])
}

func TestBuildResourceTemplate_UnknownType(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("SomeOtherKind")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "x", "bookinfo")

	assert.Equal(t, "networking.istio.io/v1", tpl["apiVersion"])
	assert.Equal(t, "SomeOtherKind", tpl["kind"])
	// No spec for unknown types.
	_, hasSpec := tpl["spec"]
	assert.False(t, hasSpec)
}

// ---------------------------------------------------------------------------
// 10. DestinationRule CRUD through Execute
// ---------------------------------------------------------------------------

func TestExecute_CreateDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "ratings-dr",
		"data":      `{"metadata":{"name":"ratings-dr","namespace":"bookinfo"},"spec":{"host":"ratings"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
	assert.Equal(t, "DestinationRule", resp.Actions[0].KindName)
}

func TestExecute_DeleteDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t, existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "reviews-dr",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

// ---------------------------------------------------------------------------
// 11. Data whitespace edge cases
// ---------------------------------------------------------------------------

func TestExecute_CreateWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = "   "

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["data"] = "\t\n  "

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

// ---------------------------------------------------------------------------
// 12. Pre-check: existence verification before mutations (through Execute)
// ---------------------------------------------------------------------------

func TestExecute_PatchNonExistentResource(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["object"] = "does-not-exist"
	args["data"] = `{"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecute_CreateAlreadyExistsDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t, existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "reviews-dr",
		"data":      `{"metadata":{"name":"reviews-dr","namespace":"bookinfo"},"spec":{"host":"reviews"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}

func TestExecute_PatchNonExistentDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "no-such-dr",
		"data":      `{"spec":{"host":"reviews"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "no-such-dr")
}

func TestExecute_DeleteNonExistentDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "no-such-dr",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "no-such-dr")
}

// ---------------------------------------------------------------------------
// 13. Panic recovery tests
// ---------------------------------------------------------------------------

func TestRecoverFromPanic_CatchesPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "VirtualService", "reviews", "bookinfo")
		panic("simulated nil pointer dereference")
	}()

	assert.Equal(t, http.StatusInternalServerError, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Internal error")
	assert.Contains(t, resStr, "VirtualService")
	assert.Contains(t, resStr, "reviews")
	assert.Contains(t, resStr, "bookinfo")
}

func TestRecoverFromPanic_NoPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "VirtualService", "reviews", "bookinfo")
		res = "success"
		status = http.StatusOK
	}()

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, "success", res)
}

// ---------------------------------------------------------------------------
// 14. classifyError tests
// ---------------------------------------------------------------------------

func TestClassifyError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantMsg    string
	}{
		{
			name:       "not found",
			err:        api_errors.NewNotFound(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews"),
			wantStatus: http.StatusNotFound,
			wantMsg:    "not found",
		},
		{
			name:       "already exists",
			err:        api_errors.NewAlreadyExists(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews"),
			wantStatus: http.StatusConflict,
			wantMsg:    "already exists",
		},
		{
			name:       "forbidden",
			err:        api_errors.NewForbidden(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews", fmt.Errorf("not allowed")),
			wantStatus: http.StatusForbidden,
			wantMsg:    "Access denied",
		},
		{
			name:       "conflict",
			err:        api_errors.NewConflict(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews", fmt.Errorf("modified")),
			wantStatus: http.StatusConflict,
			wantMsg:    "Conflict",
		},
		{
			name:       "bad request",
			err:        api_errors.NewBadRequest("invalid field"),
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid field",
		},
		{
			name:       "unknown error",
			err:        fmt.Errorf("something unexpected"),
			wantStatus: http.StatusInternalServerError,
			wantMsg:    "something unexpected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg, status := classifyError(tt.err, "VirtualService", "reviews", "bookinfo")
			assert.Equal(t, tt.wantStatus, status)
			assert.Contains(t, msg, tt.wantMsg)
		})
	}
}

// ---------------------------------------------------------------------------
// 15. Namespace existence pre-check tests
// ---------------------------------------------------------------------------

func TestIstioCreate_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestIstioPatch_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestIstioDelete_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_CreateInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_CreatePreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_PatchInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_PatchPreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_DeletePreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_DeleteInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestCheckNamespaceExists_ExistingNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()
	_ = r

	msg, code := checkNamespaceExists(r.Context(), businessLayer, "bookinfo", conf.KubernetesConfig.ClusterName)
	assert.Equal(t, 0, code)
	assert.Empty(t, msg)
}

func TestCheckNamespaceExists_MissingNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	msg, code := checkNamespaceExists(r.Context(), businessLayer, "no-such-ns", conf.KubernetesConfig.ClusterName)
	assert.Equal(t, http.StatusNotFound, code, "missing namespace should return 404")
	assert.Contains(t, msg, "no-such-ns")
	assert.Contains(t, msg, "does not exist in cluster")
}

// ---------------------------------------------------------------------------
// 16. resolveObjectName fallback tests
// ---------------------------------------------------------------------------

func TestResolveObjectName_FromObject(t *testing.T) {
	args := map[string]interface{}{"object": "my-vs"}
	assert.Equal(t, "my-vs", resolveObjectName(args))
}

func TestResolveObjectName_FromDataMetadata(t *testing.T) {
	args := map[string]interface{}{
		"data": `{"metadata":{"name":"from-data"},"spec":{"hosts":["x"]}}`,
	}
	assert.Equal(t, "from-data", resolveObjectName(args))
	assert.Equal(t, "from-data", args["object"], "should write back to args[\"object\"]")
}

func TestResolveObjectName_FromDataYAML(t *testing.T) {
	args := map[string]interface{}{
		"data": "metadata:\n  name: from-yaml\nspec:\n  hosts:\n    - x\n",
	}
	assert.Equal(t, "from-yaml", resolveObjectName(args))
	assert.Equal(t, "from-yaml", args["object"])
}

func TestResolveObjectName_Empty(t *testing.T) {
	args := map[string]interface{}{"data": "{}"}
	assert.Equal(t, "", resolveObjectName(args))
}

func TestResolveObjectName_ObjectTakesPrecedence(t *testing.T) {
	args := map[string]interface{}{
		"object": "explicit",
		"data":   `{"metadata":{"name":"from-data"}}`,
	}
	assert.Equal(t, "explicit", resolveObjectName(args))
}

func TestValidate_PatchWithNameInData(t *testing.T) {
	args := map[string]interface{}{
		"action":    "patch",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      `{"metadata":{"name":"reviews"},"spec":{"hosts":["reviews"]}}`,
	}
	err := validateIstioConfigInput(args)
	assert.NoError(t, err, "should extract object name from data's metadata.name")
	assert.Equal(t, "reviews", args["object"])
}

func TestExecute_CreateAlreadyExistsThroughExecute(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}

// ---------------------------------------------------------------------------
// 17. Gateway API support tests
// ---------------------------------------------------------------------------

func setupTestWithGatewayAPI(t *testing.T, objs ...runtime.Object) (*business.Layer, *config.Config, kubernetes.ClientFactory) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	runtimeObjs := make([]runtime.Object, 0, len(objs)+1)
	runtimeObjs = append(runtimeObjs, kubetest.FakeNamespace("bookinfo"))
	runtimeObjs = append(runtimeObjs, objs...)
	k8s := kubetest.NewFakeK8sClient(runtimeObjs...)
	k8s.GatewayAPIEnabled = true
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build(), conf, cf
}

func TestValidateManagedIstioGroupAndKind_GatewayAPIEnabled(t *testing.T) {
	gatewayAPIKinds := []string{"Gateway", "HTTPRoute", "GRPCRoute", "ReferenceGrant", "TCPRoute", "TLSRoute"}

	tests := []struct {
		name    string
		group   string
		kind    string
		enabled bool
		wantErr string
	}{
		{
			name:    "gateway API disabled rejects group",
			group:   "gateway.networking.k8s.io",
			kind:    "Gateway",
			enabled: false,
			wantErr: "Gateway API CRDs are not installed on the cluster",
		},
		{
			name:    "gateway API enabled accepts Gateway",
			group:   "gateway.networking.k8s.io",
			kind:    "Gateway",
			enabled: true,
		},
		{
			name:    "gateway API enabled accepts HTTPRoute",
			group:   "gateway.networking.k8s.io",
			kind:    "HTTPRoute",
			enabled: true,
		},
		{
			name:    "gateway API enabled accepts GRPCRoute",
			group:   "gateway.networking.k8s.io",
			kind:    "GRPCRoute",
			enabled: true,
		},
		{
			name:    "gateway API enabled accepts ReferenceGrant",
			group:   "gateway.networking.k8s.io",
			kind:    "ReferenceGrant",
			enabled: true,
		},
		{
			name:    "gateway API enabled accepts TCPRoute",
			group:   "gateway.networking.k8s.io",
			kind:    "TCPRoute",
			enabled: true,
		},
		{
			name:    "gateway API enabled accepts TLSRoute",
			group:   "gateway.networking.k8s.io",
			kind:    "TLSRoute",
			enabled: true,
		},
		{
			name:    "gateway API enabled rejects invalid kind",
			group:   "gateway.networking.k8s.io",
			kind:    "InferencePool",
			enabled: true,
			wantErr: "invalid kind",
		},
		{
			name:    "gateway API enabled still validates Istio kinds",
			group:   "networking.istio.io",
			kind:    "VirtualService",
			enabled: true,
		},
	}

	_ = gatewayAPIKinds

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateManagedIstioGroupAndKind(tt.group, tt.kind, tt.enabled)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateReadOnlyIstioConfigInput_GatewayAPIEnabled(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name: "list filter gateway API group with enabled",
			args: map[string]interface{}{"action": "list", "group": "gateway.networking.k8s.io", "kind": "HTTPRoute"},
		},
		{
			name: "list filter HTTPRoute without group infers gateway API",
			args: map[string]interface{}{"action": "list", "kind": "HTTPRoute"},
		},
		{
			name:    "list filter Gateway without group is ambiguous when GW API enabled",
			args:    map[string]interface{}{"action": "list", "kind": "Gateway"},
			wantErr: "group is required",
		},
		{
			name: "get gateway API resource with enabled",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "gateway.networking.k8s.io", "version": "v1", "kind": "Gateway", "object": "test-gw"},
		},
		{
			name:    "get gateway API invalid kind with enabled",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "gateway.networking.k8s.io", "version": "v1", "kind": "InferencePool", "object": "test"},
			wantErr: "invalid kind",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReadOnlyIstioConfigInput(tt.args, true)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateIstioConfigInput_GatewayAPIEnabled(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name: "create gateway API HTTPRoute with enabled",
			args: map[string]interface{}{
				"action": "create", "namespace": "bookinfo",
				"group": "gateway.networking.k8s.io", "version": "v1",
				"kind": "HTTPRoute", "object": "my-route", "data": "{}",
			},
		},
		{
			name: "patch gateway API Gateway with enabled",
			args: map[string]interface{}{
				"action": "patch", "namespace": "bookinfo",
				"group": "gateway.networking.k8s.io", "version": "v1",
				"kind": "Gateway", "object": "my-gw", "data": "{}",
			},
		},
		{
			name: "delete gateway API ReferenceGrant with enabled",
			args: map[string]interface{}{
				"action": "delete", "namespace": "bookinfo",
				"group": "gateway.networking.k8s.io", "version": "v1",
				"kind": "ReferenceGrant", "object": "my-rg",
			},
		},
		{
			name: "create gateway API rejected when disabled",
			args: map[string]interface{}{
				"action": "create", "namespace": "bookinfo",
				"group": "gateway.networking.k8s.io", "version": "v1",
				"kind": "HTTPRoute", "object": "my-route", "data": "{}",
			},
			wantErr: "Gateway API CRDs are not installed on the cluster",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isGatewayAPIEnabled := !strings.Contains(tt.name, "rejected when disabled")
			err := validateIstioConfigInput(tt.args, isGatewayAPIEnabled)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestExecuteReadOnly_GatewayAPIEnabled_ListFilterGateway(t *testing.T) {
	businessLayer, conf, cf := setupTestWithGatewayAPI(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action": "list",
		"group":  "gateway.networking.k8s.io",
		"kind":   "HTTPRoute",
	}

	res, status := ExecuteReadOnly(kialiIntfWithFactory(r, businessLayer, conf, cf), args)
	require.Equal(t, http.StatusOK, status)
	result, ok := res.(IstioListResult)
	require.True(t, ok, "expected IstioListResult, got %T", res)
	assert.NotNil(t, result.Namespaces)
}

func TestExecute_GatewayAPIEnabled_CreateHTTPRoute(t *testing.T) {
	businessLayer, conf, cf := setupTestWithGatewayAPI(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "gateway.networking.k8s.io",
		"version":   "v1",
		"kind":      "HTTPRoute",
		"object":    "my-route",
		"data":      `{"metadata":{"name":"my-route","namespace":"bookinfo"},"spec":{"parentRefs":[{"name":"my-gw"}],"rules":[{"backendRefs":[{"name":"reviews","port":80}]}]}}`,
	}

	res, status := Execute(kialiIntfWithFactory(r, businessLayer, conf, cf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
	assert.Equal(t, "HTTPRoute", resp.Actions[0].KindName)
	assert.Equal(t, "gateway.networking.k8s.io", resp.Actions[0].Group)
}

func TestExecute_GatewayAPIDisabled_RejectsCreate(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "gateway.networking.k8s.io",
		"version":   "v1",
		"kind":      "HTTPRoute",
		"object":    "my-route",
		"data":      `{"metadata":{"name":"my-route","namespace":"bookinfo"},"spec":{}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Gateway API CRDs are not installed on the cluster")
}

func TestBuildResourceTemplate_K8sGateway(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "gateway.networking.k8s.io", Version: "v1", Kind: "Gateway"}
	tpl := buildResourceTemplate(gvk, "my-gw", "bookinfo")

	assert.Equal(t, "gateway.networking.k8s.io/v1", tpl["apiVersion"])
	assert.Equal(t, "Gateway", tpl["kind"])
	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "istio", spec["gatewayClassName"])
	assert.NotNil(t, spec["listeners"])
}

func TestBuildResourceTemplate_HTTPRoute(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "gateway.networking.k8s.io", Version: "v1", Kind: "HTTPRoute"}
	tpl := buildResourceTemplate(gvk, "my-route", "bookinfo")

	assert.Equal(t, "gateway.networking.k8s.io/v1", tpl["apiVersion"])
	assert.Equal(t, "HTTPRoute", tpl["kind"])
	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["parentRefs"])
	rules, ok := spec["rules"].([]interface{})
	require.True(t, ok)
	require.Len(t, rules, 1)
	rule := rules[0].(map[string]interface{})
	matches, ok := rule["matches"].([]interface{})
	require.True(t, ok)
	require.Len(t, matches, 1)
	match := matches[0].(map[string]interface{})
	path := match["path"].(map[string]interface{})
	assert.Equal(t, "PathPrefix", path["type"])
	assert.Equal(t, "/", path["value"])
}

func TestFixHTTPRoutePathTypes(t *testing.T) {
	input := []byte(`{"spec":{"rules":[{"matches":[{"path":{"type":"Prefix","value":"/"}}]}]}}`)
	fixed := fixHTTPRoutePathTypes(input)
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(fixed, &obj))
	spec := obj["spec"].(map[string]interface{})
	rules := spec["rules"].([]interface{})
	rule := rules[0].(map[string]interface{})
	matches := rule["matches"].([]interface{})
	match := matches[0].(map[string]interface{})
	path := match["path"].(map[string]interface{})
	assert.Equal(t, "PathPrefix", path["type"])
	assert.Equal(t, "/", path["value"])
}

func TestDefaultIstioConfigCriteria_GatewayAPIEnabled(t *testing.T) {
	criteria := defaultIstioConfigCriteria(true, false)
	assert.True(t, criteria.IncludeK8sGateways)
	assert.True(t, criteria.IncludeK8sHTTPRoutes)
	assert.True(t, criteria.IncludeK8sGRPCRoutes)
	assert.True(t, criteria.IncludeK8sReferenceGrants)
	assert.True(t, criteria.IncludeK8sTCPRoutes)
	assert.True(t, criteria.IncludeK8sTLSRoutes)
	assert.False(t, criteria.IncludeK8sInferencePools)
	assert.True(t, criteria.IncludeVirtualServices)
}

func TestDefaultIstioConfigCriteria_GatewayAPIDisabled(t *testing.T) {
	criteria := defaultIstioConfigCriteria(false, false)
	assert.False(t, criteria.IncludeK8sGateways)
	assert.False(t, criteria.IncludeK8sHTTPRoutes)
	assert.False(t, criteria.IncludeK8sGRPCRoutes)
	assert.False(t, criteria.IncludeK8sReferenceGrants)
	assert.False(t, criteria.IncludeK8sTCPRoutes)
	assert.False(t, criteria.IncludeK8sTLSRoutes)
	assert.False(t, criteria.IncludeK8sInferencePools)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
}

func TestDefaultIstioConfigCriteria_InferenceAPIEnabled(t *testing.T) {
	criteria := defaultIstioConfigCriteria(false, true)
	assert.False(t, criteria.IncludeK8sGateways)
	assert.True(t, criteria.IncludeK8sInferencePools)
	assert.True(t, criteria.IncludeVirtualServices)
}

func TestDefaultIstioConfigCriteria_BothEnabled(t *testing.T) {
	criteria := defaultIstioConfigCriteria(true, true)
	assert.True(t, criteria.IncludeK8sGateways)
	assert.True(t, criteria.IncludeK8sHTTPRoutes)
	assert.True(t, criteria.IncludeK8sInferencePools)
	assert.True(t, criteria.IncludeVirtualServices)
}

func TestValidateManagedIstioGroupAndKind_InferenceAPIEnabled(t *testing.T) {
	tests := []struct {
		name    string
		group   string
		kind    string
		gwFlag  bool
		infFlag bool
		wantErr string
	}{
		{
			name:    "inference API disabled rejects group",
			group:   "inference.networking.k8s.io",
			kind:    "InferencePool",
			gwFlag:  false,
			infFlag: false,
			wantErr: "Inference API CRDs are not installed on the cluster",
		},
		{
			name:    "inference API enabled accepts InferencePool",
			group:   "inference.networking.k8s.io",
			kind:    "InferencePool",
			gwFlag:  false,
			infFlag: true,
		},
		{
			name:    "inference API enabled rejects invalid kind",
			group:   "inference.networking.k8s.io",
			kind:    "InvalidKind",
			gwFlag:  false,
			infFlag: true,
			wantErr: "invalid kind",
		},
		{
			name:    "inference API enabled still validates Istio kinds",
			group:   "networking.istio.io",
			kind:    "VirtualService",
			gwFlag:  false,
			infFlag: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateManagedIstioGroupAndKind(tt.group, tt.kind, tt.gwFlag, tt.infFlag)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestExecuteReadOnly_InferenceAPIDisabled(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "inference.networking.k8s.io",
		"version":   "v1alpha2",
		"kind":      "InferencePool",
		"object":    "test-pool",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestBuildResourceTemplate_InferencePool(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "inference.networking.k8s.io", Version: "v1", Kind: "InferencePool"}
	tpl := buildResourceTemplate(gvk, "my-pool", "default")
	assert.Equal(t, "inference.networking.k8s.io/v1", tpl["apiVersion"])
	assert.Equal(t, "InferencePool", tpl["kind"])
	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	targetPorts, ok := spec["targetPorts"].([]interface{})
	require.True(t, ok)
	require.Len(t, targetPorts, 1)
	port := targetPorts[0].(map[string]interface{})
	assert.Equal(t, 8000, port["number"])
	selector, ok := spec["selector"].(map[string]interface{})
	require.True(t, ok)
	matchLabels, ok := selector["matchLabels"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "example-model", matchLabels["app"])
	epr, ok := spec["endpointPickerRef"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "Service", epr["kind"])
	assert.Equal(t, "example-model-epp", epr["name"])
	assert.Equal(t, "FailClose", epr["failureMode"])
}

// ---------------------------------------------------------------------------
// fixHTTPRoutePathTypes unit tests
// ---------------------------------------------------------------------------

func TestFixHTTPRoutePathTypes_PrefixCorrected(t *testing.T) {
	input := `{"spec":{"rules":[{"matches":[{"path":{"type":"Prefix","value":"/api"}}]}]}}`
	output := fixHTTPRoutePathTypes([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	path := obj["spec"].(map[string]interface{})["rules"].([]interface{})[0].(map[string]interface{})["matches"].([]interface{})[0].(map[string]interface{})["path"].(map[string]interface{})
	assert.Equal(t, "PathPrefix", path["type"], "LLM 'Prefix' should be corrected to 'PathPrefix'")
	assert.Equal(t, "/api", path["value"], "path value should be preserved")
}

func TestFixHTTPRoutePathTypes_AlreadyPathPrefix(t *testing.T) {
	input := `{"spec":{"rules":[{"matches":[{"path":{"type":"PathPrefix","value":"/api"}}]}]}}`
	output := fixHTTPRoutePathTypes([]byte(input))
	assert.JSONEq(t, input, string(output), "already-correct PathPrefix should be unchanged")
}

func TestFixHTTPRoutePathTypes_ExactTypeUntouched(t *testing.T) {
	input := `{"spec":{"rules":[{"matches":[{"path":{"type":"Exact","value":"/ping"}}]}]}}`
	output := fixHTTPRoutePathTypes([]byte(input))
	assert.JSONEq(t, input, string(output), "Exact path type should not be modified")
}

func TestFixHTTPRoutePathTypes_MultipleRulesAndMatches(t *testing.T) {
	input := `{"spec":{"rules":[{"matches":[{"path":{"type":"Prefix","value":"/a"}},{"path":{"type":"Exact","value":"/b"}}]},{"matches":[{"path":{"type":"Prefix","value":"/c"}}]}]}}`
	output := fixHTTPRoutePathTypes([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	rules := obj["spec"].(map[string]interface{})["rules"].([]interface{})
	// rule[0] match[0]: Prefix → PathPrefix
	m00 := rules[0].(map[string]interface{})["matches"].([]interface{})[0].(map[string]interface{})["path"].(map[string]interface{})
	assert.Equal(t, "PathPrefix", m00["type"])
	// rule[0] match[1]: Exact → unchanged
	m01 := rules[0].(map[string]interface{})["matches"].([]interface{})[1].(map[string]interface{})["path"].(map[string]interface{})
	assert.Equal(t, "Exact", m01["type"])
	// rule[1] match[0]: Prefix → PathPrefix
	m10 := rules[1].(map[string]interface{})["matches"].([]interface{})[0].(map[string]interface{})["path"].(map[string]interface{})
	assert.Equal(t, "PathPrefix", m10["type"])
}

func TestFixHTTPRoutePathTypes_InvalidJSONPassthrough(t *testing.T) {
	input := []byte(`not-json`)
	output := fixHTTPRoutePathTypes(input)
	assert.Equal(t, input, output, "invalid JSON should be returned unchanged")
}

// ---------------------------------------------------------------------------
// fixInferencePoolSpec unit tests
// ---------------------------------------------------------------------------

func TestFixInferencePoolSpec_TargetPortNumberMigrated(t *testing.T) {
	input := `{"spec":{"targetPortNumber":8080,"selector":{"matchLabels":{"app":"model"}},"endpointPickerRef":{"kind":"Service","name":"epp"}}}`
	output := fixInferencePoolSpec([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	spec := obj["spec"].(map[string]interface{})
	assert.Nil(t, spec["targetPortNumber"], "targetPortNumber should be removed")
	targetPorts, ok := spec["targetPorts"].([]interface{})
	require.True(t, ok, "targetPorts should be set")
	require.Len(t, targetPorts, 1)
	assert.Equal(t, float64(8080), targetPorts[0].(map[string]interface{})["number"])
}

func TestFixInferencePoolSpec_FlatSelectorWrapped(t *testing.T) {
	input := `{"spec":{"targetPorts":[{"number":8000}],"selector":{"app":"my-model"},"endpointPickerRef":{"kind":"Service","name":"epp"}}}`
	output := fixInferencePoolSpec([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	sel := obj["spec"].(map[string]interface{})["selector"].(map[string]interface{})
	ml, ok := sel["matchLabels"].(map[string]interface{})
	require.True(t, ok, "flat selector should be wrapped under matchLabels")
	assert.Equal(t, "my-model", ml["app"])
}

func TestFixInferencePoolSpec_AlreadyMatchLabelsSelectorUnchanged(t *testing.T) {
	input := `{"spec":{"targetPorts":[{"number":8000}],"selector":{"matchLabels":{"app":"x"}},"endpointPickerRef":{"kind":"Service","name":"epp"}}}`
	output := fixInferencePoolSpec([]byte(input))
	assert.JSONEq(t, input, string(output), "already-correct selector should not be double-wrapped")
}

func TestFixInferencePoolSpec_MissingEndpointPickerRefAdded(t *testing.T) {
	input := `{"spec":{"targetPorts":[{"number":8000}],"selector":{"matchLabels":{"app":"x"}}}}`
	output := fixInferencePoolSpec([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	epr := obj["spec"].(map[string]interface{})["endpointPickerRef"].(map[string]interface{})
	assert.Equal(t, "Service", epr["kind"])
	assert.Equal(t, "example-model-epp", epr["name"])
	assert.Equal(t, "FailClose", epr["failureMode"])
}

func TestFixInferencePoolSpec_ExistingEndpointPickerRefPreserved(t *testing.T) {
	input := `{"spec":{"targetPorts":[{"number":8000}],"selector":{"matchLabels":{"app":"x"}},"endpointPickerRef":{"kind":"Service","name":"my-real-epp"}}}`
	output := fixInferencePoolSpec([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	epr := obj["spec"].(map[string]interface{})["endpointPickerRef"].(map[string]interface{})
	assert.Equal(t, "my-real-epp", epr["name"], "user-provided endpointPickerRef.name should not be overwritten")
}

func TestFixInferencePoolSpec_MissingTargetPortsAdded(t *testing.T) {
	input := `{"spec":{"selector":{"matchLabels":{"app":"x"}},"endpointPickerRef":{"kind":"Service","name":"epp"}}}`
	output := fixInferencePoolSpec([]byte(input))
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(output, &obj))
	targetPorts, ok := obj["spec"].(map[string]interface{})["targetPorts"].([]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(8000), targetPorts[0].(map[string]interface{})["number"])
}

func TestFixInferencePoolSpec_InvalidJSONPassthrough(t *testing.T) {
	input := []byte(`not-json`)
	output := fixInferencePoolSpec(input)
	assert.Equal(t, input, output, "invalid JSON should be returned unchanged")
}

// ---------------------------------------------------------------------------
// inferGroupFromKind unit tests
// ---------------------------------------------------------------------------

func TestInferGroupFromKind(t *testing.T) {
	tests := []struct {
		name                  string
		kind                  string
		isGatewayAPIEnabled   bool
		isInferenceAPIEnabled bool
		expectedGroup         string
	}{
		{
			name:          "security kind inferred without any flags",
			kind:          "AuthorizationPolicy",
			expectedGroup: "security.istio.io",
		},
		{
			name:          "networking-only kind inferred when GW API disabled",
			kind:          "VirtualService",
			expectedGroup: "networking.istio.io",
		},
		{
			name:                "networking-only kind inferred when GW API enabled",
			kind:                "VirtualService",
			isGatewayAPIEnabled: true,
			expectedGroup:       "networking.istio.io",
		},
		{
			name:                "Gateway is ambiguous when GW API enabled",
			kind:                "Gateway",
			isGatewayAPIEnabled: true,
			expectedGroup:       "",
		},
		{
			name:                "Gateway infers networking.istio.io when GW API disabled",
			kind:                "Gateway",
			isGatewayAPIEnabled: false,
			expectedGroup:       "networking.istio.io",
		},
		{
			name:                  "InferencePool inferred when inference API enabled",
			kind:                  "InferencePool",
			isInferenceAPIEnabled: true,
			expectedGroup:         "inference.networking.k8s.io",
		},
		{
			name:                  "InferencePool returns empty when inference API disabled",
			kind:                  "InferencePool",
			isInferenceAPIEnabled: false,
			expectedGroup:         "",
		},
		{
			name:                "HTTPRoute inferred as gateway API when enabled",
			kind:                "HTTPRoute",
			isGatewayAPIEnabled: true,
			expectedGroup:       "gateway.networking.k8s.io",
		},
		{
			name:                "HTTPRoute returns empty when GW API disabled",
			kind:                "HTTPRoute",
			isGatewayAPIEnabled: false,
			expectedGroup:       "",
		},
		{
			name:          "unknown kind returns empty",
			kind:          "NoSuchKind",
			expectedGroup: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := inferGroupFromKind(tt.kind, tt.isGatewayAPIEnabled, tt.isInferenceAPIEnabled)
			assert.Equal(t, tt.expectedGroup, got)
		})
	}
}
