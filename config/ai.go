package config

import (
	_ "embed"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"

	"gopkg.in/yaml.v2"

	"github.com/kiali/kiali/log"
)

const (
	// DefaultAIPricingFilePath is where the operator/helm chart mounts the user-managed
	// pricing ConfigMap named by ai.consumption.prizes_config_map (key: prices.yaml).
	DefaultAIPricingFilePath = "/kiali-ai-pricing/prices.yaml"
)

//go:embed ai_default_prices.yaml
var defaultModelPricingYAML []byte

type defaultModelPricingFile struct {
	Models []ModelPricing `yaml:"models"`
}

var (
	defaultModelPricings     []ModelPricing
	defaultModelPricingsOnce sync.Once
)

// credentialOverride maps a config Credential field to a mounted secret file name.
type credentialOverride struct {
	configValue *Credential
	fileName    string
}

const (
	// Chat AI credential secret prefixes (used to build dynamic volume names)
	secretFileChatAIProviderPrefix = "chat-ai-provider"
	secretFileChatAIModelPrefix    = "chat-ai-model"
)

var aiSecretNameSanitizer = regexp.MustCompile(`[^a-z0-9-]+`)

func sanitizeAISecretName(name string) string {
	sanitized := strings.ToLower(name)
	sanitized = aiSecretNameSanitizer.ReplaceAllString(sanitized, "-")
	sanitized = strings.Trim(sanitized, "-")
	if sanitized == "" {
		return "unknown"
	}
	return sanitized
}

func chatAIProviderSecretFileName(providerName string) string {
	return fmt.Sprintf("%s-%s", secretFileChatAIProviderPrefix, sanitizeAISecretName(providerName))
}

func chatAIModelSecretFileName(providerName, modelName string) string {
	return fmt.Sprintf("%s-%s-%s", secretFileChatAIModelPrefix, sanitizeAISecretName(providerName), sanitizeAISecretName(modelName))
}

// AiStoreConfig defines configuration for the AI store subsystem
type AiStoreConfig struct {
	Enabled                 bool           `yaml:"enabled,omitempty" json:"enabled,omitempty"`                                    // Default: true
	InactivityTimeout       DurationString `yaml:"inactivity_timeout,omitempty" json:"inactivityTimeout,omitempty"`               // Default: "30m"
	HistoryTokenBudgetRatio float64        `yaml:"history_token_budget_ratio,omitempty" json:"historyTokenBudgetRatio,omitempty"` // Default: 0.85
	MaxCacheMemoryMB        int            `yaml:"max_cache_memory_mb,omitempty" json:"maxCacheMemoryMB,omitempty"`               // Default: 1024
	ReduceWithAI            bool           `yaml:"reduce_with_ai,omitempty" json:"reduceWithAI,omitempty"`                        // Default: false
	ReduceThreshold         int            `yaml:"reduce_threshold,omitempty" json:"reduceThreshold,omitempty"`                   // Default: 15 messages
}

type AIModel struct {
	Name        string     `yaml:"name" json:"name"`
	Model       string     `yaml:"model" json:"model"`
	Description string     `yaml:"description,omitempty" json:"description,omitempty"`
	Enabled     bool       `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	Endpoint    string     `yaml:"endpoint,omitempty" json:"endpoint,omitempty"`
	Key         Credential `yaml:"key,omitempty" json:"key,omitempty"`
}

type ToolFilterConfig struct {
	DisabledTools []string `yaml:"disabled_tools,omitempty" json:"disabled_tools,omitempty"`
	EnabledTools  []string `yaml:"enabled_tools,omitempty" json:"enabled_tools,omitempty"`
}

type ProviderType string

const (
	AnthropicProvider   ProviderType = "anthropic"
	DefaultProviderType ProviderType = "default"
	GoogleProvider      ProviderType = "google"
	LightSpeedProvider  ProviderType = "lightspeed"
	OpenAIProvider      ProviderType = "openai"
)

type ProviderConfigType string

const (
	OpenAIProviderConfigAzure ProviderConfigType = "azure"
	ProviderConfigGemini      ProviderConfigType = "gemini"
	DefaultProviderConfigType ProviderConfigType = "default"
)

type ProviderConfig struct {
	Config             ProviderConfigType `yaml:"config" json:"config"`
	DefaultModel       string             `yaml:"default_model,omitempty" json:"default_model,omitempty"`
	Description        string             `yaml:"description,omitempty" json:"description,omitempty"`
	Enabled            bool               `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	Endpoint           string             `yaml:"endpoint,omitempty" json:"endpoint,omitempty"`
	InsecureSkipVerify bool               `yaml:"insecure_skip_verify,omitempty" json:"insecureSkipVerify,omitempty"`
	Key                Credential         `yaml:"key,omitempty" json:"key,omitempty"`
	Models             []AIModel          `yaml:"models,omitempty" json:"models,omitempty"`
	Name               string             `yaml:"name" json:"name"`
	Tools              ToolFilterConfig   `yaml:"tools,omitempty" json:"tools,omitempty"`
	Type               ProviderType       `yaml:"type" json:"type"`
}

// AIConfig defines configuration for the AI subsystem
type AIConfig struct {
	Enabled     bool                `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	ChatAI      ChatAIConfig        `yaml:"chat,omitempty" json:"chat,omitempty"`
	Metrics     bool                `yaml:"metrics,omitempty" json:"metrics,omitempty"`
	Consumption AIConsumptionConfig `yaml:"consumption,omitempty" json:"consumption,omitempty"`
}

// AIConsumptionConfig defines configuration for the AI consumption subsystem
// This is used to configure the AI consumption subsystem.
// This require AI.Metrics to be enabled.
type AIConsumptionConfig struct {
	AllowedUsersDashboard []string           `yaml:"allowed_users_dashboard,omitempty" json:"allowed_users_dashboard,omitempty"`
	PrizesConfigMap       string             `yaml:"prizes_config_map,omitempty" json:"prizes_config_map,omitempty"` // ConfigMap name in the Kiali namespace; empty uses the built-in catalog
	Budgets               []UserBudgetConfig `yaml:"budgets,omitempty" json:"budgets,omitempty"`

	// ModelPricings is the resolved token-pricing catalog used for cost estimates.
	// It is loaded from the mounted prizes ConfigMap when PrizesConfigMap is set,
	// otherwise from the embedded ai_default_prices.yaml. Not part of the YAML config.
	ModelPricings []ModelPricing `yaml:"-" json:"-"`
}

type BudgetInterval string

const (
	WeeklyBudget  BudgetInterval = "weekly"
	MonthlyBudget BudgetInterval = "monthly"
)

// UserBudgetConfig defines budget limits and model/provider restrictions for users.
type UserBudgetConfig struct {
	Usernames        []string       `yaml:"usernames,omitempty" json:"usernames,omitempty"`
	Interval         BudgetInterval `yaml:"interval,omitempty" json:"interval,omitempty"`
	MaxCost          float64        `yaml:"max_cost,omitempty" json:"max_cost,omitempty"`
	MaxTokens        float64        `yaml:"max_tokens,omitempty" json:"max_tokens,omitempty"`
	AllowedProviders []ProviderType `yaml:"allowed_providers,omitempty" json:"allowed_providers,omitempty"`
	AllowedModels    []string       `yaml:"allowed_models,omitempty" json:"allowed_models,omitempty"`
}

// ModelPricing defines per-model token pricing used for AI consumption cost estimates.
type ModelPricing struct {
	Enabled  bool         `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	Provider ProviderType `yaml:"provider,omitempty" json:"provider_type,omitempty"`
	ModelID  string       `yaml:"model_id,omitempty" json:"model_id,omitempty"`
	Currency string       `yaml:"currency,omitempty" json:"currency,omitempty"`
	Prices   TokenPrices  `yaml:"prices,omitempty" json:"amount,omitempty"`
}

// TokenPrices defines configuration for the token prices subsystem
type TokenPrices struct {
	InputCostPerMillion  float64 `yaml:"input_cost_per_million" json:"input_cost_per_million"`
	OutputCostPerMillion float64 `yaml:"output_cost_per_million" json:"output_cost_per_million"`

	// Optional fields for specific features (e.g. Prompt Caching of Claude)
	CacheWriteCostPerMillion float64 `yaml:"cache_write_cost_per_million,omitempty" json:"cache_write_cost_per_million,omitempty"`
	CacheReadCostPerMillion  float64 `yaml:"cache_read_cost_per_million,omitempty" json:"cache_read_cost_per_million,omitempty"`
}

// ChatAIConfig defines configuration for the ChatAI subsystem
type ChatAIConfig struct {
	DefaultProvider   string           `yaml:"default_provider,omitempty" json:"default_provider,omitempty"`
	Enabled           bool             `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	MaxToolIterations int              `yaml:"max_tool_iterations,omitempty" json:"max_tool_iterations,omitempty"`
	Providers         []ProviderConfig `yaml:"providers,omitempty" json:"providers,omitempty"`
	StoreConfig       AiStoreConfig    `yaml:"store_config,omitempty" json:"store_config,omitempty"`
	Tools             ToolFilterConfig `yaml:"tools,omitempty" json:"tools,omitempty"`
	AllowedUsers      []string         `yaml:"allowed_users,omitempty" json:"allowed_users,omitempty"`
}

func parseModelPricingsYAML(data []byte) ([]ModelPricing, error) {
	var file defaultModelPricingFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return nil, err
	}
	if len(file.Models) == 0 {
		return nil, fmt.Errorf("pricing catalog has no models")
	}
	pricings := make([]ModelPricing, len(file.Models))
	for i, pricing := range file.Models {
		pricing.Enabled = true
		pricings[i] = pricing
	}
	return pricings, nil
}

func loadModelPricingsFromFile(path string) ([]ModelPricing, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return parseModelPricingsYAML(data)
}

func loadDefaultModelPricings() []ModelPricing {
	defaultModelPricingsOnce.Do(func() {
		pricings, err := parseModelPricingsYAML(defaultModelPricingYAML)
		if err != nil {
			log.Errorf("Failed to parse embedded ai_default_prices.yaml: %v", err)
			return
		}
		defaultModelPricings = pricings
	})

	out := make([]ModelPricing, len(defaultModelPricings))
	copy(out, defaultModelPricings)
	return out
}

// resolveModelPricings loads the token-pricing catalog used for consumption cost estimates.
// An empty prizes_config_map uses the embedded ai_default_prices.yaml. When a ConfigMap
// name is set, prices are read from DefaultAIPricingFilePath (mounted by the operator/helm
// chart). If that file is missing or invalid, Kiali logs the error and falls back to the
// built-in catalog.
func (c *AIConsumptionConfig) resolveModelPricings() {
	if strings.TrimSpace(c.PrizesConfigMap) == "" {
		c.ModelPricings = loadDefaultModelPricings()
		return
	}

	pricings, err := loadModelPricingsFromFile(DefaultAIPricingFilePath)
	if err != nil {
		log.Errorf("Failed to load AI pricing catalog from ConfigMap %q (%s): %v; using built-in catalog", c.PrizesConfigMap, DefaultAIPricingFilePath, err)
		c.ModelPricings = loadDefaultModelPricings()
		return
	}

	c.ModelPricings = pricings
	log.Infof("Loaded %d AI model prices from ConfigMap %q", len(pricings), c.PrizesConfigMap)
}

// NewAIConfig returns the default AI configuration.
func NewAIConfig() AIConfig {
	return AIConfig{
		ChatAI: ChatAIConfig{
			Enabled:           false,
			DefaultProvider:   "",
			MaxToolIterations: 5,
			Providers:         []ProviderConfig{},
			StoreConfig: AiStoreConfig{
				Enabled:                 true,
				InactivityTimeout:       "30m",
				MaxCacheMemoryMB:        1024,
				HistoryTokenBudgetRatio: 0.85,
				ReduceWithAI:            false,
				ReduceThreshold:         15,
			},
		},
		Consumption: AIConsumptionConfig{
			AllowedUsersDashboard: []string{},
			PrizesConfigMap:       "",
			Budgets:               []UserBudgetConfig{},
			ModelPricings:         loadDefaultModelPricings(),
		},
		Enabled: false,
		Metrics: false,
	}
}

func MatchModelPattern(pattern, value string) bool {
	if pattern == "*" {
		return true
	}
	if strings.Contains(pattern, "*") {
		parts := strings.Split(pattern, "*")
		if len(parts) == 1 {
			return pattern == value
		}
		if !strings.HasPrefix(value, parts[0]) {
			return false
		}
		for _, part := range parts[1:] {
			if part == "" {
				continue
			}
			idx := strings.Index(value, part)
			if idx == -1 {
				return false
			}
			value = value[idx+len(part):]
		}
		return true
	}
	return pattern == value
}

func budgetUsernameKey(username string) string {
	if username == "anonymous-shared" {
		return "anonymous"
	}
	return username
}

// GetBudgetForUser finds the most specific UserBudgetConfig for a given username.
// It prioritizes an exact username match. If none is found, it falls back to a wildcard "*" match.
// Returns nil if no matching budget configuration is found.
func (consumption *AIConsumptionConfig) GetBudgetForUser(username string) *UserBudgetConfig {
	requested := budgetUsernameKey(username)
	// First pass: look for exact match
	for i := range consumption.Budgets {
		b := &consumption.Budgets[i]
		for _, u := range b.Usernames {
			if budgetUsernameKey(u) == requested {
				return b
			}
		}
	}
	// Second pass: look for wildcard match
	for i := range consumption.Budgets {
		b := &consumption.Budgets[i]
		for _, u := range b.Usernames {
			if u == "*" {
				return b
			}
		}
	}
	return nil
}

func (consumption *AIConsumptionConfig) ValidateConsumption(chatAI *ChatAIConfig) error {
	for i, b := range consumption.Budgets {
		if len(b.Usernames) == 0 {
			return fmt.Errorf("ai.consumption.budgets[%d]: usernames must not be empty", i)
		}
		if b.Interval != "" && b.Interval != WeeklyBudget && b.Interval != MonthlyBudget {
			return fmt.Errorf("ai.consumption.budgets[%d]: interval must be either 'weekly' or 'monthly', got %q", i, b.Interval)
		}
		if b.MaxCost < 0 {
			return fmt.Errorf("ai.consumption.budgets[%d]: max_cost must be non-negative, got %f", i, b.MaxCost)
		}
		if b.MaxTokens < 0 {
			return fmt.Errorf("ai.consumption.budgets[%d]: max_tokens must be non-negative, got %f", i, b.MaxTokens)
		}

		// Validate AllowedProviders are defined in chat providers
		if chatAI != nil {
			for _, ap := range b.AllowedProviders {
				foundProvider := false
				for _, cp := range chatAI.Providers {
					if cp.Type == ap {
						foundProvider = true
						break
					}
				}
				if !foundProvider {
					return fmt.Errorf("ai.consumption.budgets[%d]: allowed provider %q is not defined in ai.chat.providers", i, ap)
				}
			}

			// Validate AllowedModels are defined in chat providers/models
			for _, am := range b.AllowedModels {
				if am == "*" {
					continue
				}
				foundModel := false
				for _, cp := range chatAI.Providers {
					// If AllowedProviders is specified, only check models of allowed providers
					if len(b.AllowedProviders) > 0 {
						isAllowedProvider := false
						for _, ap := range b.AllowedProviders {
							if cp.Type == ap {
								isAllowedProvider = true
								break
							}
						}
						if !isAllowedProvider {
							continue
						}
					}

					for _, cm := range cp.Models {
						if MatchModelPattern(am, cm.Name) || MatchModelPattern(am, cm.Model) {
							foundModel = true
							break
						}
					}
					if foundModel {
						break
					}
				}
				if !foundModel {
					return fmt.Errorf("ai.consumption.budgets[%d]: allowed model %q is not defined/enabled under any matching provider in ai.chat.providers", i, am)
				}
			}
		}
	}
	return nil
}

func (conf *Config) ValidateAI() error {
	if conf.AI.Enabled {
		if err := conf.AI.ChatAI.ValidateChatAI(); err != nil {
			return err
		}
		if err := conf.AI.Consumption.ValidateConsumption(&conf.AI.ChatAI); err != nil {
			return err
		}
	}
	return nil
}

// migrateDeprecatedChatAI moves settings from the deprecated top-level "chat_ai" yaml
// setting into the new "ai.chat" location. "defaultChatAI" is the zero-config default
// for "ai.chat" (i.e. what it looked like before the yaml was parsed) so we can tell
// whether the yaml itself set "ai.chat" or if it is still just sitting at the default.
//
// TODO: Remove this migration once the deprecated "chat_ai" top-level setting is no longer supported.
func (conf *Config) migrateDeprecatedChatAI(defaultChatAI ChatAIConfig) {
	if reflect.DeepEqual(conf.ChatAI, ChatAIConfig{}) {
		// The deprecated "chat_ai" setting was not present in the yaml - nothing to migrate.
		return
	}

	if !reflect.DeepEqual(conf.AI.ChatAI, defaultChatAI) {
		// The new "ai.chat" setting was also explicitly configured - it wins, and the
		// deprecated setting is discarded so there is only ever one source of truth.
		log.Warning("Both the deprecated 'chat_ai' setting and the new 'ai.chat' setting are configured - 'ai.chat' will be used. Remove 'chat_ai' from your configuration.")
		conf.ChatAI = ChatAIConfig{}
		return
	}

	log.Info("DEPRECATION NOTICE: 'chat_ai' has been deprecated - switch to 'ai.chat'")
	conf.AI.ChatAI = conf.ChatAI
	if conf.AI.ChatAI.MaxToolIterations == 0 {
		conf.AI.ChatAI.MaxToolIterations = defaultChatAI.MaxToolIterations
	}
	if conf.ChatAI.Enabled {
		conf.AI.Enabled = true
	}
	conf.ChatAI = ChatAIConfig{}
}

func (chatAI *ChatAIConfig) ValidateChatAI() error {
	if !chatAI.Enabled {
		return nil
	}

	if chatAI.MaxToolIterations < 1 || chatAI.MaxToolIterations > 20 {
		return fmt.Errorf("chat_ai.max_tool_iterations must be between 1 and 20, got %d", chatAI.MaxToolIterations)
	}

	if err := normalizeAndValidateToolFilter("chat_ai.tools", &chatAI.Tools); err != nil {
		return err
	}

	if chatAI.DefaultProvider == "" {
		return fmt.Errorf("chat_ai.default_provider is required when chat_ai.enabled is true")
	}

	defaultProviderFound := false
	validCompatibleProviderTypes := map[ProviderType][]ProviderConfigType{
		AnthropicProvider:  {DefaultProviderConfigType},
		GoogleProvider:     {ProviderConfigGemini},
		LightSpeedProvider: {DefaultProviderConfigType},
		OpenAIProvider:     {DefaultProviderConfigType, OpenAIProviderConfigAzure, ProviderConfigGemini},
	}

	seenNames := make(map[string]struct{})

	for i := range chatAI.Providers {
		p := &chatAI.Providers[i]
		if !p.Enabled {
			continue
		}
		if err := normalizeAndValidateToolFilter(fmt.Sprintf("chat_ai.providers[%q].tools", p.Name), &p.Tools); err != nil {
			return err
		}
		if _, exists := seenNames[p.Name]; exists {
			return fmt.Errorf("chat_ai.providers contains duplicate name %q", p.Name)
		}
		seenNames[p.Name] = struct{}{}

		if p.Name == chatAI.DefaultProvider {
			defaultProviderFound = true
			if !p.Enabled {
				return fmt.Errorf("chat_ai.default_provider %q must be enabled", chatAI.DefaultProvider)
			}
		}

		if !p.Enabled {
			continue
		}

		if p.Type == "" || p.Type == DefaultProviderType {
			log.Infof("chat_ai.providers[%q].type is empty; defaulting to %q", p.Name, OpenAIProvider)
			p.Type = OpenAIProvider
		}
		if _, valid := validCompatibleProviderTypes[p.Type]; !valid {
			return fmt.Errorf("chat_ai.providers[%q].type %q is invalid or not supported. Available types are: %v", p.Name, p.Type, validCompatibleProviderTypes[p.Type])
		}

		if p.Config == "" {
			defaultValue := DefaultProviderConfigType
			if p.Type == GoogleProvider {
				defaultValue = ProviderConfigGemini
			}
			log.Infof("chat_ai.providers[%q].config is empty; defaulting to %q for provider type %s", p.Name, defaultValue, p.Type)
			p.Config = defaultValue
		}

		if !slices.Contains(validCompatibleProviderTypes[p.Type], p.Config) {
			return fmt.Errorf("chat_ai.providers[%q].config %q is invalid. Available configs are: %v", p.Name, p.Config, validCompatibleProviderTypes[p.Type])
		}

		// LightSpeed is a special case:
		//   - No models, default_model, or API key are needed — authentication is
		//     handled per-request via the Kiali user's Kubernetes bearer token.
		//   - Only the provider-level endpoint is required.
		//   - config defaults to DefaultProviderConfigType when empty (handled above).
		//   - A synthetic model entry (named after the provider) is auto-created so
		//     the frontend always has at least one selectable model.
		if p.Type == LightSpeedProvider {
			if p.Endpoint == "" {
				return fmt.Errorf("chat_ai.providers[%q] of type %q requires an endpoint", p.Name, LightSpeedProvider)
			}
			if len(p.Models) == 0 {
				p.Models = []AIModel{{Name: p.Name, Enabled: true}}
				p.DefaultModel = p.Name
			}
			continue
		}

		if p.DefaultModel == "" {
			return fmt.Errorf("chat_ai.providers[%q].default_model is required", p.Name)
		}

		defaultModelFound := false
		providerModelNames := make(map[string]struct{})
		for _, m := range p.Models {
			if _, exists := providerModelNames[m.Name]; exists {
				return fmt.Errorf("chat_ai.providers[%q].models contains duplicate name %q", p.Name, m.Name)
			}
			providerModelNames[m.Name] = struct{}{}

			if m.Name == p.DefaultModel {
				defaultModelFound = true
				if !m.Enabled {
					return fmt.Errorf("chat_ai.providers[%q].default_model %q must be enabled", p.Name, p.DefaultModel)
				}
			}

			if m.Key == "" && p.Key == "" && m.Enabled {
				return fmt.Errorf("chat_ai.providers[%q].models[%q] requires a key when provider key is empty", p.Name, m.Name)
			}
		}

		if !defaultModelFound {
			return fmt.Errorf("chat_ai.providers[%q].default_model %q not found in models", p.Name, p.DefaultModel)
		}
	}

	if !defaultProviderFound {
		return fmt.Errorf("chat_ai.default_provider %q not found in providers", chatAI.DefaultProvider)
	}

	return nil
}

func normalizeAndValidateToolFilter(path string, filter *ToolFilterConfig) error {
	if filter == nil {
		return nil
	}

	enabledSet := make(map[string]struct{}, len(filter.EnabledTools))
	for i, name := range filter.EnabledTools {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			return fmt.Errorf("%s.enabled_tools[%d] must not be empty", path, i)
		}
		if _, exists := enabledSet[trimmed]; exists {
			return fmt.Errorf("%s.enabled_tools contains duplicate name %q", path, trimmed)
		}
		enabledSet[trimmed] = struct{}{}
		filter.EnabledTools[i] = trimmed
	}

	disabledSet := make(map[string]struct{}, len(filter.DisabledTools))
	for i, name := range filter.DisabledTools {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			return fmt.Errorf("%s.disabled_tools[%d] must not be empty", path, i)
		}
		if _, exists := disabledSet[trimmed]; exists {
			return fmt.Errorf("%s.disabled_tools contains duplicate name %q", path, trimmed)
		}
		disabledSet[trimmed] = struct{}{}
		filter.DisabledTools[i] = trimmed
	}

	return nil
}

// Obfuscate masks sensitive AI provider credentials.
func (ai *AIConfig) Obfuscate() {
	if len(ai.ChatAI.Providers) == 0 {
		return
	}
	providers := make([]ProviderConfig, len(ai.ChatAI.Providers))
	copy(providers, ai.ChatAI.Providers)
	for i := range providers {
		providers[i].Key = "xxx"
		if len(providers[i].Models) == 0 {
			continue
		}
		models := make([]AIModel, len(providers[i].Models))
		copy(models, providers[i].Models)
		for j := range models {
			models[j].Key = "xxx"
		}
		providers[i].Models = models
	}
	ai.ChatAI.Providers = providers
}

func (conf *Config) aiCredentialOverrides() []credentialOverride {
	var overrides []credentialOverride
	for i := range conf.AI.ChatAI.Providers {
		provider := &conf.AI.ChatAI.Providers[i]
		if provider.Enabled {
			overrides = append(overrides, credentialOverride{
				configValue: &provider.Key,
				fileName:    chatAIProviderSecretFileName(provider.Name),
			})
			for j := range provider.Models {
				if provider.Models[j].Enabled {
					overrides = append(overrides, credentialOverride{
						configValue: &provider.Models[j].Key,
						fileName:    chatAIModelSecretFileName(provider.Name, provider.Models[j].Name),
					})
				}
			}
		}
	}
	return overrides
}
