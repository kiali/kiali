// Dev-only MCP stdio shim: exposes ai/mcp/tools/*.yaml to MCP Inspector and
// proxies tools/call to a running Kiali via POST /api/chat/mcp/{tool}.
//
// Not for production. See README.md.
package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"gopkg.in/yaml.v3"
)

const (
	defaultToolset = "mcp"
	serverName     = "kiali-mcp-dev"
	serverVersion  = "0.1.0"
)

type toolYAML struct {
	Name        string                 `yaml:"name"`
	Description string                 `yaml:"description"`
	Toolset     []string               `yaml:"toolset"`
	InputSchema map[string]interface{} `yaml:"input_schema"`
}

type kialiClient struct {
	baseURL    string
	token      string
	cookie     string
	kialiUI    bool
	httpClient *http.Client
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kiali-mcp-dev: %v\n", err)
		os.Exit(1)
	}

	toolsDir, err := resolveToolsDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kiali-mcp-dev: %v\n", err)
		os.Exit(1)
	}

	defs, err := loadToolDefs(toolsDir, cfg.toolset)
	if err != nil {
		fmt.Fprintf(os.Stderr, "kiali-mcp-dev: %v\n", err)
		os.Exit(1)
	}
	if len(defs) == 0 {
		fmt.Fprintf(os.Stderr, "kiali-mcp-dev: no tools matched toolset %q in %s\n", cfg.toolset, toolsDir)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "kiali-mcp-dev: KIALI_URL=%s toolset=%s tools=%d dir=%s\n",
		cfg.client.baseURL, cfg.toolset, len(defs), toolsDir)

	s := server.NewMCPServer(
		serverName,
		serverVersion,
		server.WithToolCapabilities(false),
	)

	for _, def := range defs {
		schemaBytes, err := json.Marshal(def.InputSchema)
		if err != nil {
			fmt.Fprintf(os.Stderr, "kiali-mcp-dev: skip %s: schema marshal: %v\n", def.Name, err)
			continue
		}
		if len(def.InputSchema) == 0 {
			schemaBytes = []byte(`{"type":"object","properties":{}}`)
		}
		tool := mcp.NewToolWithRawSchema(def.Name, def.Description, schemaBytes)
		name := def.Name
		s.AddTool(tool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return cfg.client.callTool(ctx, name, request.GetArguments())
		})
	}

	if err := server.ServeStdio(s); err != nil {
		fmt.Fprintf(os.Stderr, "kiali-mcp-dev: server error: %v\n", err)
		os.Exit(1)
	}
}

type config struct {
	client  *kialiClient
	toolset string
}

func loadConfig() (*config, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("KIALI_URL")), "/")
	if baseURL == "" {
		baseURL = "http://localhost:20001"
	}

	toolset := strings.TrimSpace(os.Getenv("KIALI_MCP_TOOLSET"))
	if toolset == "" {
		toolset = defaultToolset
	}

	insecure := strings.EqualFold(os.Getenv("KIALI_INSECURE"), "true") ||
		strings.EqualFold(os.Getenv("KIALI_INSECURE"), "1")

	timeout := 90 * time.Second
	if v := strings.TrimSpace(os.Getenv("KIALI_TIMEOUT")); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("KIALI_TIMEOUT: %w", err)
		}
		timeout = d
	}

	return &config{
		toolset: toolset,
		client: &kialiClient{
			baseURL: baseURL,
			token:   strings.TrimSpace(os.Getenv("KIALI_TOKEN")),
			cookie:  strings.TrimSpace(os.Getenv("KIALI_COOKIE")),
			kialiUI: strings.EqualFold(os.Getenv("KIALI_UI"), "true") ||
				strings.EqualFold(os.Getenv("KIALI_UI"), "1"),
			httpClient: &http.Client{
				Timeout: timeout,
				Transport: &http.Transport{
					TLSClientConfig: &tls.Config{InsecureSkipVerify: insecure}, //nolint:gosec // local/dev only
				},
			},
		},
	}, nil
}

func resolveToolsDir() (string, error) {
	if override := strings.TrimSpace(os.Getenv("KIALI_MCP_TOOLS_DIR")); override != "" {
		return filepath.Clean(override), nil
	}
	// Prefer ../tools relative to this package (ai/mcp/tools).
	here, err := os.Getwd()
	if err != nil {
		return "", err
	}
	candidates := []string{
		filepath.Join(here, "..", "tools"),
		filepath.Join(here, "tools"),
	}
	// When launched as `go run .` from __dev__, cwd is __dev__.
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			return filepath.Clean(c), nil
		}
	}
	return "", fmt.Errorf("could not find tools directory (tried %v); set KIALI_MCP_TOOLS_DIR", candidates)
}

func loadToolDefs(toolsDir, toolsetFilter string) ([]toolYAML, error) {
	entries, err := os.ReadDir(toolsDir)
	if err != nil {
		return nil, fmt.Errorf("read tools dir: %w", err)
	}

	var out []toolYAML
	for _, e := range entries {
		if e.IsDir() || !(strings.HasSuffix(e.Name(), ".yaml") || strings.HasSuffix(e.Name(), ".yml")) {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(toolsDir, e.Name()))
		if err != nil {
			return nil, err
		}
		def, err := parseToolYAML(raw, e.Name())
		if err != nil {
			return nil, err
		}
		if !matchToolset(def.Toolset, toolsetFilter) {
			continue
		}
		out = append(out, def)
	}
	return out, nil
}

// parseToolYAML mirrors ai/mcp.loadToolDefinitionFromContent: files are usually a
// one-element YAML sequence (- name: ...), with a single mapping as fallback.
func parseToolYAML(raw []byte, filename string) (toolYAML, error) {
	var list []toolYAML
	if err := yaml.Unmarshal(raw, &list); err == nil && len(list) > 0 {
		if len(list) > 1 {
			return toolYAML{}, fmt.Errorf("%s: contains multiple tools", filename)
		}
		if list[0].Name == "" {
			return toolYAML{}, fmt.Errorf("%s: missing name", filename)
		}
		return list[0], nil
	}
	var def toolYAML
	if err := yaml.Unmarshal(raw, &def); err != nil {
		return toolYAML{}, fmt.Errorf("%s: %w", filename, err)
	}
	if def.Name == "" {
		return toolYAML{}, fmt.Errorf("%s: missing name", filename)
	}
	return def, nil
}

func matchToolset(toolsets []string, filter string) bool {
	if filter == "all" {
		return true
	}
	for _, t := range toolsets {
		if t == filter {
			return true
		}
	}
	return false
}

func (c *kialiClient) callTool(ctx context.Context, name string, args map[string]any) (*mcp.CallToolResult, error) {
	if args == nil {
		args = map[string]any{}
	}
	body, err := json.Marshal(args)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("marshal args: %v", err)), nil
	}

	url := fmt.Sprintf("%s/api/chat/mcp/%s", c.baseURL, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	if c.cookie != "" {
		req.Header.Set("Cookie", c.cookie)
	}
	if c.kialiUI {
		req.Header.Set("Kiali-UI", "true")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("POST %s: %v", url, err)), nil
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("read response: %v", err)), nil
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(respBody))
		if msg == "" {
			msg = resp.Status
		}
		return mcp.NewToolResultError(fmt.Sprintf("HTTP %d: %s", resp.StatusCode, msg)), nil
	}

	text := string(respBody)
	if json.Valid(respBody) {
		var pretty bytes.Buffer
		if err := json.Indent(&pretty, respBody, "", "  "); err == nil {
			text = pretty.String()
		}
	}
	return mcp.NewToolResultText(text), nil
}
