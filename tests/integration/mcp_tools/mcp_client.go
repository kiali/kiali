package mcp_tools

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kiali/kiali/log"
)

var mcpClient *MCPClient

const MCPTimeout = 30 * time.Second

type MCPClient struct {
	kialiURL   string
	httpClient *http.Client
}

type MCPResponse struct {
	Body       []byte
	StatusCode int
	Parsed     map[string]interface{}
}

func init() {
	mcpClient = newMCPClient()
}

func newMCPClient() *MCPClient {
	url := strings.TrimRight(os.Getenv("URL"), "/")
	if url == "" {
		log.Fatalf("URL environment variable is required.")
	}
	return &MCPClient{
		kialiURL: url,
		httpClient: &http.Client{
			Timeout: MCPTimeout,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

func mcpToolURL(toolName string) string {
	return fmt.Sprintf("%s/api/chat/mcp/%s", mcpClient.kialiURL, toolName)
}

func CallMCPTool(toolName string, args map[string]interface{}) (*MCPResponse, error) {
	var body []byte
	var err error
	if args != nil {
		body, err = json.Marshal(args)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal args: %w", err)
		}
	} else {
		body = []byte("{}")
	}

	url := mcpToolURL(toolName)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	httpResp, err := mcpClient.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("POST %s failed: %w", url, err)
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	resp := &MCPResponse{
		Body:       respBody,
		StatusCode: httpResp.StatusCode,
	}

	if len(respBody) > 0 {
		_ = json.Unmarshal(respBody, &resp.Parsed)
	}

	return resp, nil
}

func CallMCPToolEmptyBody(toolName string) (*MCPResponse, error) {
	return CallMCPTool(toolName, nil)
}
