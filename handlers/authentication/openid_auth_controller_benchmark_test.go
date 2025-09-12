package authentication

import (
	"testing"

	"github.com/kiali/kiali/config"
)

// Benchmark tests for verifyAudienceClaim function to ensure multi-audience support doesn't impact performance

func BenchmarkVerifyAudienceClaim_SingleAudience(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": oidCfg.ClientId,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_SingleElementArray_Interface(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []interface{}{oidCfg.ClientId},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_SingleElementArray_String(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []string{oidCfg.ClientId},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_MultiAudience_Interface_First(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []interface{}{oidCfg.ClientId, "other-service", "api-gateway"},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_MultiAudience_Interface_Last(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []interface{}{"other-service", "api-gateway", oidCfg.ClientId},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_MultiAudience_String_First(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []string{oidCfg.ClientId, "other-service", "api-gateway"},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_MultiAudience_String_Last(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": []string{"other-service", "api-gateway", oidCfg.ClientId},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_LargeAudienceArray_Interface_First(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	// Create a larger audience array to test performance with many audiences
	largeAudiences := make([]interface{}, 20)
	largeAudiences[0] = oidCfg.ClientId // Put target at the beginning
	for i := 1; i < 20; i++ {
		largeAudiences[i] = "service-" + string(rune('a'+i))
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": largeAudiences,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_LargeAudienceArray_Interface_Last(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	// Create a larger audience array to test performance with many audiences
	largeAudiences := make([]interface{}, 20)
	for i := 0; i < 19; i++ {
		largeAudiences[i] = "service-" + string(rune('a'+i))
	}
	largeAudiences[19] = oidCfg.ClientId // Put target at the end

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": largeAudiences,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_LargeAudienceArray_String_First(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	// Create a larger audience array to test performance with many audiences
	largeAudiences := make([]string, 20)
	largeAudiences[0] = oidCfg.ClientId // Put target at the beginning
	for i := 1; i < 20; i++ {
		largeAudiences[i] = "service-" + string(rune('a'+i))
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": largeAudiences,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}

func BenchmarkVerifyAudienceClaim_LargeAudienceArray_String_Last(b *testing.B) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	// Create a larger audience array to test performance with many audiences
	largeAudiences := make([]string, 20)
	for i := 0; i < 19; i++ {
		largeAudiences[i] = "service-" + string(rune('a'+i))
	}
	largeAudiences[19] = oidCfg.ClientId // Put target at the end

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{
			"aud": largeAudiences,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = verifyAudienceClaim(&oip, oidCfg)
	}
}
