package log

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
)

func TestEnvVarLogLevel(t *testing.T) {
	type levelsToTestStruct struct {
		stringLevel string
		level       zerolog.Level
	}

	levelsToTest := []levelsToTestStruct{
		{
			stringLevel: "FATAL",
			level:       zerolog.FatalLevel,
		},
		{
			stringLevel: "fatal",
			level:       zerolog.FatalLevel,
		},
		{
			stringLevel: "FaTaL",
			level:       zerolog.FatalLevel,
		},
		{
			stringLevel: "ERROR",
			level:       zerolog.ErrorLevel,
		},
		{
			stringLevel: "WARN",
			level:       zerolog.WarnLevel,
		},
		{
			stringLevel: "INFO",
			level:       zerolog.InfoLevel,
		},
		{
			stringLevel: "DEBUG",
			level:       zerolog.DebugLevel,
		},
		{
			stringLevel: "TRACE",
			level:       zerolog.TraceLevel,
		},
		{
			stringLevel: "invalid",
			level:       zerolog.InfoLevel,
		},
	}

	for _, levelToTest := range levelsToTest {
		t.Setenv("LOG_LEVEL", levelToTest.stringLevel)
		assert.Equal(t, levelToTest.level, resolveLogLevelFromEnv(), fmt.Sprintf("LOG_LEVEL=%v,levelToTest=%+v", os.Getenv("LOG_LEVEL"), levelToTest))
	}
}

func TestLogRegression(t *testing.T) {
	type loggedMessageAsJsonStruct struct {
		Level   string
		Time    string
		Message string
	}

	type logOutputTestStruct struct {
		envSettings        map[string]string
		expectedLogMessage string
	}

	tests := []logOutputTestStruct{
		{
			envSettings: map[string]string{
				"LOG_FORMAT": "text",
			},
			expectedLogMessage: "INF Kiali logging test 0: map[LOG_FORMAT:text]",
		},
		{
			envSettings: map[string]string{
				"LOG_FORMAT":            "text",
				"LOG_LEVEL":             "debug",
				"LOG_TIME_FIELD_FORMAT": time.RFC1123Z,
			},
			expectedLogMessage: "INF Kiali logging test 1: map[LOG_FORMAT:text LOG_LEVEL:debug LOG_TIME_FIELD_FORMAT:Mon, 02 Jan 2006 15:04:05 -0700]",
		},
		{
			envSettings: map[string]string{
				"LOG_FORMAT":            "json",
				"LOG_LEVEL":             "debug",
				"LOG_TIME_FIELD_FORMAT": time.RFC1123Z,
			},
			expectedLogMessage: "Kiali logging test 2: map[LOG_FORMAT:json LOG_LEVEL:debug LOG_TIME_FIELD_FORMAT:Mon, 02 Jan 2006 15:04:05 -0700]",
		},
	}

	for index, test := range tests {

		t.Logf("Cleaned env vars")
		os.Clearenv()
		for envName, envValue := range test.envSettings {
			t.Setenv(envName, envValue)
		}
		t.Logf("Set ENVs: %v", os.Environ())

		t.Run(fmt.Sprintf("Test %d", index), func(t *testing.T) {

			buf := &bytes.Buffer{}
			log.Logger = InitializeLogger().Output(buf)

			if !isJsonLogFormat() {
				t.Logf("Overwrite logger for test %d", index)
				log.Logger = log.Logger.Output(zerolog.ConsoleWriter{Out: buf, TimeFormat: zerolog.TimeFieldFormat, NoColor: true})
			}

			Infof("Kiali logging %s %d: %v", "test", index, test.envSettings)

			loggedMessage := buf.String()
			t.Logf("Logged message: %s", loggedMessage)

			var timestampAsString string
			isRightLogFormat := false
			hasLogLevelInformation := false

			if isJSON(loggedMessage) {
				var loggedMessageAsJson loggedMessageAsJsonStruct
				_ = json.Unmarshal([]byte(loggedMessage), &loggedMessageAsJson)
				timestampAsString = loggedMessageAsJson.Time
				loggedMessage = loggedMessageAsJson.Message
				isRightLogFormat = isJsonLogFormat()
				parsedLevel, _ := zerolog.ParseLevel(loggedMessageAsJson.Level)
				hasLogLevelInformation = parsedLevel == zerolog.InfoLevel
			} else {
				isRightLogFormat = !isJsonLogFormat()
				timestampAsString = strings.Split(loggedMessage, " INF")[0]
				hasLogLevelInformation = strings.Contains(loggedMessage, "INF")
			}

			timestamp, _ := time.Parse(zerolog.TimeFieldFormat, timestampAsString)
			assert.True(t, strings.Contains(loggedMessage, test.expectedLogMessage))
			assert.True(t, isRightLogFormat)
			assert.True(t, hasLogLevelInformation)
			assert.NotNil(t, timestamp)
		})
	}
}

func TestEnvVarLogSampler(t *testing.T) {
	os.Clearenv()
	t.Logf("Cleaned env vars")
	t.Setenv("LOG_SAMPLER_RATE", "10")
	t.Setenv("LOG_FORMAT", "json")
	t.Setenv("LOG_LEVEL", "debug")
	t.Logf("Set ENVs: %v", os.Environ())

	buf := &bytes.Buffer{}
	log.Logger = InitializeLogger().Output(buf)

	numberOfLogs := 0
	for numberOfLogs < 10 {
		Info("Kiali logging test")
		numberOfLogs++
	}

	numberOfLogMessages := 0
	numberOfLogMessages = bytes.Count(buf.Bytes(), []byte{'\n'})

	t.Logf("Logged messages: %d - %s", numberOfLogMessages, buf.String())

	assert.Equal(t, 1, numberOfLogMessages)
}

func TestSupportedTimeFormats(t *testing.T) {
	type formatsToTestStruct struct {
		format     string
		testResult string
	}

	formatsToTest := []formatsToTestStruct{
		{
			format:     time.RFC1123Z,
			testResult: time.RFC1123Z,
		},
		{
			format:     "some-imaginary-format",
			testResult: time.RFC3339,
		},
		{
			format:     "1990-07-06T15:07:05Z09:00",
			testResult: time.RFC3339,
		},
	}

	for _, formatToTest := range formatsToTest {
		t.Setenv("LOG_TIME_FIELD_FORMAT", formatToTest.format)
		assert.Equal(t, formatToTest.testResult, resolveTimeFormatFromEnv(), fmt.Sprintf("LOG_TIME_FIELD_FORMAT=%v,formatToTest=%+v", os.Getenv("LOG_TIME_FIELD_FORMAT"), formatToTest))
	}

}

func isJSON(s string) bool {
	var js map[string]interface{}
	return json.Unmarshal([]byte(s), &js) == nil
}

func isJsonLogFormat() bool {
	return os.Getenv("LOG_FORMAT") == "json"
}
