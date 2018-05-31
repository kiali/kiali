package status

import (
	"testing"
)

func TestValidateVersion(t *testing.T) {
	result := validateVersion(">= 0.7.1", "0.7.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.7.1 is >= 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "0.8.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.1 is >= 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "1.3.0")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.3.0 is >= 0.7.1")
	}

	result = validateVersion("== 0.7.1", "1.3.0")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 1.3.0 is not == 0.7.1")
	}

	result = validateVersion("> 0.7.1", "1.3.0")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.3.0 is > 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "0.6.3")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 0.6.3 is not >= 0.7.1")
	}

	result = validateVersion("> 0.7.1", "0.6.3")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 0.6.3 is not > 0.7.1")
	}

	// Alpha / Beta versions

	result = validateVersion("> 0.7.1", "0.8.3-alpha")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3-alpha is > 0.7.1")
	}

	result = validateVersion(">= 0.8.3-alpha", "0.8.3-alpha")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3-alpha is >= 0.8.3-alpha")
	}

	// Longer releases

	result = validateVersion(">= 0.8.3", "0.8.3.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3.1 is >= 0.8.3")
	}

	result = validateVersion("> 0.9", "0.9.1.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.9.1.1 is > 0.9")
	}

	result = validateVersion("> 0.8.1.1", "0.8.2")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.2 is > 0.8.1.1")
	}

	result = validateVersion("> 0.8.1.1", "1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1 is > 0.8.1.1")
	}
}
