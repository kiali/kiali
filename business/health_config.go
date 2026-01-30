package business

import (
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// HealthRateMatcher provides methods to match health rate configuration to entities.
// It caches compiled regex patterns for performance.
type HealthRateMatcher struct {
	cache map[int]*compiledRate // keyed by index in conf.HealthConfig.Rate
	conf  *config.Config
	mu    sync.RWMutex
}

// compiledRate holds pre-compiled regex patterns for a Rate config
type compiledRate struct {
	kind      *regexp.Regexp
	name      *regexp.Regexp
	namespace *regexp.Regexp
	tolerance []CompiledTolerance
}

// CompiledTolerance holds pre-compiled regex patterns for a Tolerance config.
// This is the public version used by HealthCalculator.
type CompiledTolerance struct {
	Code      *regexp.Regexp
	Degraded  float32
	Direction *regexp.Regexp
	Failure   float32
	Protocol  *regexp.Regexp
}

// NewHealthRateMatcher creates a new HealthRateMatcher with the given config.
// It pre-compiles all regex patterns from the health configuration.
func NewHealthRateMatcher(conf *config.Config) *HealthRateMatcher {
	m := &HealthRateMatcher{
		conf:  conf,
		cache: make(map[int]*compiledRate),
	}
	// Pre-compile all patterns
	m.compileAllPatterns()
	return m
}

// compileAllPatterns pre-compiles all regex patterns from the configuration
func (m *HealthRateMatcher) compileAllPatterns() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.conf.HealthConfig.Rate {
		m.cache[i] = m.compileRate(&m.conf.HealthConfig.Rate[i])
	}
}

// compileRate compiles regex patterns for a single Rate config
func (m *HealthRateMatcher) compileRate(rate *config.Rate) *compiledRate {
	compiled := &compiledRate{
		namespace: compilePattern(rate.Namespace, ".*"),
		kind:      compilePattern(rate.Kind, ".*"),
		name:      compilePattern(rate.Name, ".*"),
		tolerance: make([]CompiledTolerance, len(rate.Tolerance)),
	}

	for i, tol := range rate.Tolerance {
		compiled.tolerance[i] = CompileTolerance(tol)
	}

	return compiled
}

// CompileTolerance compiles a config.Tolerance into a CompiledTolerance.
// This is used for both config-based and annotation-based tolerances.
func CompileTolerance(tol config.Tolerance) CompiledTolerance {
	return CompiledTolerance{
		Code:      compileCodePattern(tol.Code, ".*"),
		Protocol:  compilePattern(tol.Protocol, ".*"),
		Direction: compilePattern(tol.Direction, ".*"),
		Degraded:  tol.Degraded,
		Failure:   tol.Failure,
	}
}

// compilePattern compiles a regex pattern, using defaultPattern if empty
func compilePattern(pattern, defaultPattern string) *regexp.Regexp {
	if pattern == "" {
		pattern = defaultPattern
	}
	// Ensure full string match by anchoring if not already anchored
	if !strings.HasPrefix(pattern, "^") {
		pattern = "^" + pattern
	}
	if !strings.HasSuffix(pattern, "$") {
		pattern = pattern + "$"
	}

	re, err := regexp.Compile(pattern)
	if err != nil {
		log.Warningf("Invalid health config regex pattern '%s': %v. Using default '.*'", pattern, err)
		re = regexp.MustCompile("^.*$")
	}
	return re
}

// compileCodePattern compiles a code pattern, replacing X/x with \d for digit matching
func compileCodePattern(pattern, defaultPattern string) *regexp.Regexp {
	if pattern == "" {
		pattern = defaultPattern
	}
	// Replace X or x with \d (digit wildcard) - matches frontend behavior
	pattern = strings.ReplaceAll(pattern, "X", `\d`)
	pattern = strings.ReplaceAll(pattern, "x", `\d`)

	return compilePattern(pattern, defaultPattern)
}

// GetMatchingRate returns the Rate config that matches the given entity (namespace, name, kind).
// Returns nil if no match is found (should not happen if defaults are configured correctly).
// Rates are checked in order, so more specific rates should be defined before more general ones.
func (m *HealthRateMatcher) GetMatchingRate(namespace, name, kind string) *config.Rate {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Iterate in order (0 to len-1) to respect rate priority
	// More specific rates should be defined first in the config
	for i := 0; i < len(m.conf.HealthConfig.Rate); i++ {
		compiled := m.cache[i]
		if compiled != nil &&
			compiled.namespace.MatchString(namespace) &&
			compiled.name.MatchString(name) &&
			compiled.kind.MatchString(kind) {
			return &m.conf.HealthConfig.Rate[i]
		}
	}

	// Fall back to the last rate (should be the default with empty/wildcard patterns)
	if len(m.conf.HealthConfig.Rate) > 0 {
		return &m.conf.HealthConfig.Rate[len(m.conf.HealthConfig.Rate)-1]
	}

	return nil
}

// ParseHealthAnnotation parses a health rate annotation value and returns the tolerances.
// Annotation format: "code,degraded,failure,protocol,direction" (semicolon-separated for multiple)
// Example: "4xx,10,20,http,inbound;5xx,5,10,http,inbound"
// Returns nil if the annotation is empty or invalid.
// Logs a warning if parsing fails, as per the design decision.
func ParseHealthAnnotation(annotation string) []config.Tolerance {
	if annotation == "" {
		return nil
	}

	var tolerances []config.Tolerance
	parts := strings.Split(annotation, ";")

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		fields := strings.Split(part, ",")
		if len(fields) != 5 {
			log.Warningf("Invalid health annotation format '%s': expected 5 comma-separated fields (code,degraded,failure,protocol,direction)", part)
			continue
		}

		var degraded, failure float32
		if _, err := parseFloat32(fields[1], &degraded); err != nil {
			log.Warningf("Invalid health annotation degraded threshold '%s': %v", fields[1], err)
			continue
		}
		if _, err := parseFloat32(fields[2], &failure); err != nil {
			log.Warningf("Invalid health annotation failure threshold '%s': %v", fields[2], err)
			continue
		}

		if degraded > failure {
			log.Warningf("Invalid health annotation: degraded threshold (%v) > failure threshold (%v)", degraded, failure)
			continue
		}

		tolerances = append(tolerances, config.Tolerance{
			Code:      fields[0],
			Degraded:  degraded,
			Failure:   failure,
			Protocol:  fields[3],
			Direction: fields[4],
		})
	}

	if len(tolerances) == 0 && annotation != "" {
		log.Warningf("Health annotation '%s' produced no valid tolerances, falling back to defaults", annotation)
	}

	return tolerances
}

// parseFloat32 parses a string to float32
func parseFloat32(s string, result *float32) (bool, error) {
	s = strings.TrimSpace(s)
	f64, err := strconv.ParseFloat(s, 32)
	if err != nil {
		return false, err
	}
	*result = float32(f64)
	return true, nil
}

// HealthAnnotationKey is the annotation key for health rate configuration
const HealthAnnotationKey = "health.kiali.io/rate"

// GetCompiledTolerances returns pre-compiled tolerances for an entity, with annotation overrides.
// This is the preferred method for health calculation as it avoids regex recompilation.
func (m *HealthRateMatcher) GetCompiledTolerances(namespace, name, kind string, annotations map[string]string) []CompiledTolerance {
	// Check for annotation override
	if annotations != nil {
		if annotationValue, ok := annotations[HealthAnnotationKey]; ok && annotationValue != "" {
			annotationTolerances := ParseHealthAnnotation(annotationValue)
			if len(annotationTolerances) > 0 {
				// Compile annotation-based tolerances
				return CompileTolerances(annotationTolerances)
			}
			// If annotation parsing failed, fall through to config-based tolerances
		}
	}

	// Use pre-compiled config-based tolerances
	return m.getCompiledTolerancesForEntity(namespace, name, kind)
}

// getCompiledTolerancesForEntity returns the pre-compiled tolerances for an entity from the cache.
func (m *HealthRateMatcher) getCompiledTolerancesForEntity(namespace, name, kind string) []CompiledTolerance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Find matching rate
	for i := 0; i < len(m.conf.HealthConfig.Rate); i++ {
		compiled := m.cache[i]
		if compiled != nil &&
			compiled.namespace.MatchString(namespace) &&
			compiled.name.MatchString(name) &&
			compiled.kind.MatchString(kind) {
			return compiled.tolerance
		}
	}

	// Fall back to the last rate's tolerances
	if len(m.conf.HealthConfig.Rate) > 0 {
		lastIdx := len(m.conf.HealthConfig.Rate) - 1
		if compiled := m.cache[lastIdx]; compiled != nil {
			return compiled.tolerance
		}
	}

	return nil
}

// CompileTolerances compiles a slice of config.Tolerance into CompiledTolerance.
func CompileTolerances(tolerances []config.Tolerance) []CompiledTolerance {
	if len(tolerances) == 0 {
		return nil
	}
	compiled := make([]CompiledTolerance, len(tolerances))
	for i, tol := range tolerances {
		compiled[i] = CompileTolerance(tol)
	}
	return compiled
}
