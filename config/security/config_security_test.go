package security

import (
	"testing"
)

func TestValidateCredentials(t *testing.T) {
	creds := &Credentials{}
	if err := creds.ValidateCredentials(); err != nil {
		t.Errorf("Empty credentials should be valid: %v", err)
	}

	if headerName, headerValue, err := creds.GetHTTPAuthHeader(); err != nil {
		t.Errorf("Should not have received error: %v", err)
	} else {
		if headerName != "" || headerValue != "" {
			t.Errorf("Bad auth header: %v=%v", headerName, headerValue)
		}
	}

	creds = &Credentials{
		Username: "u",
		Password: "p",
	}
	if err := creds.ValidateCredentials(); err != nil {
		t.Errorf("Username/Password credentials should be valid: %v", err)
	}

	if headerName, headerValue, err := creds.GetHTTPAuthHeader(); err != nil {
		t.Errorf("Should not have received error: %v", err)
	} else {
		if headerName != "Authorization" || headerValue != "Basic dTpw" {
			t.Errorf("Bad auth header for %v: %v=%v", creds, headerName, headerValue)
		}
	}

	creds = &Credentials{
		Token: "t",
	}
	if err := creds.ValidateCredentials(); err != nil {
		t.Errorf("Token credentials should be valid: %v", err)
	}

	if headerName, headerValue, err := creds.GetHTTPAuthHeader(); err != nil {
		t.Errorf("Should not have received error: %v", err)
	} else {
		if headerName != "Authorization" || headerValue != "Bearer t" {
			t.Errorf("Bad auth header for %v: %v=%v", creds, headerName, headerValue)
		}
	}

	creds = &Credentials{
		Username: "u",
		Password: "p",
		Token:    "t",
	}
	if err := creds.ValidateCredentials(); err == nil {
		t.Error("Setting both Username/Password and Token should be invalid")
	}

	creds = &Credentials{
		Username: "u",
	}
	if err := creds.ValidateCredentials(); err == nil {
		t.Error("Setting Username without Password should be invalid")
	}

	creds = &Credentials{
		Password: "p",
	}
	if err := creds.ValidateCredentials(); err == nil {
		t.Error("Setting Password without Username should be invalid")
	}
}
