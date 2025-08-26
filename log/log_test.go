package log

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/util"
	pathutil "github.com/kiali/kiali/util/path"
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
		Time    string `json:"ts"`
		Message string `json:"msg"`
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
	t.Logf("Cleaned env vars")
	t.Setenv("LOG_SAMPLER_RATE", "10")
	t.Setenv("LOG_FORMAT", "json")
	t.Setenv("LOG_LEVEL", "debug")
	t.Logf("Set ENVs: %v", os.Environ())

	buf := &bytes.Buffer{}
	log.Logger = InitializeLogger().Output(buf)

	// return the sampling back to 1 to avoid screwing up other tests
	defer func() {
		log.Logger = log.Sample(&zerolog.BasicSampler{N: uint32(1)})
	}()

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

func TestContextLoggerJson(t *testing.T) {
	type loggedMessageAsJsonStruct struct {
		Message string `json:"msg"`
		Level   string
		Ctx1    string
		Ctx2    string
		Group   string
	}

	type logOutputTestStruct struct {
		expectedMessage string
		expectedLevel   string
		expectedContext map[string]string
	}

	tests := []logOutputTestStruct{
		{
			expectedMessage: "Kiali error logging test",
			expectedLevel:   "error",
			expectedContext: map[string]string{
				"ctx1": "foo",
				"ctx2": "bar",
			},
		},
		{
			expectedMessage: "Kiali warn logging test",
			expectedLevel:   "warn",
			expectedContext: map[string]string{
				"ctx1": "splat",
				"ctx2": "boo",
			},
		},
		{
			expectedMessage: "Kiali info logging test",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx1": "this is first",
				"ctx2": "this is second",
			},
		},
		{
			expectedMessage: "Kiali debug logging test",
			expectedLevel:   "debug",
			expectedContext: map[string]string{
				"ctx1": "number 1",
				"ctx2": "number 2",
			},
		},
		{
			expectedMessage: "Kiali trace logging test",
			expectedLevel:   "trace",
			expectedContext: map[string]string{
				"ctx1": "first",
				"ctx2": "second",
			},
		},
		{
			expectedMessage: "Kiali just first context",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx1": "just one",
			},
		},
		{
			expectedMessage: "Kiali just second context",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx2": "just two",
			},
		},
		{
			expectedMessage: "Kiali no context",
			expectedLevel:   "info",
			expectedContext: map[string]string{},
		},
	}

	t.Setenv("LOG_LEVEL", "trace") // we want to test every level
	t.Setenv("LOG_FORMAT", "json")

	for index, test := range tests {
		t.Run(fmt.Sprintf("Test %d", index), func(t *testing.T) {
			buf := &bytes.Buffer{}
			log.Logger = InitializeLogger().Output(buf)

			ctx := log.Logger.With()
			for k, v := range test.expectedContext {
				ctx = ctx.Str(k, v)
			}
			testlogger := ctx.Logger()

			switch test.expectedLevel {
			case "error":
				testlogger.Error().Msg(test.expectedMessage)
			case "warn":
				testlogger.Warn().Msg(test.expectedMessage)
			case "info":
				testlogger.Info().Msg(test.expectedMessage)
			case "debug":
				testlogger.Debug().Msg(test.expectedMessage)
			case "trace":
				testlogger.Trace().Msg(test.expectedMessage)
			default:
				testlogger.Error().Msg("Test provided a bad log level")
			}

			loggedMessage := buf.String()
			t.Logf("Logged message: %s", loggedMessage)

			level := ""
			ctx1 := ""
			ctx2 := ""
			isRightLogFormat := isJSON(loggedMessage)
			if isRightLogFormat {
				var loggedMessageAsJson loggedMessageAsJsonStruct
				_ = json.Unmarshal([]byte(loggedMessage), &loggedMessageAsJson)
				loggedMessage = loggedMessageAsJson.Message
				level = loggedMessageAsJson.Level
				ctx1 = loggedMessageAsJson.Ctx1
				ctx2 = loggedMessageAsJson.Ctx2

				assert.Equal(t, test.expectedMessage, loggedMessage)
				assert.Equal(t, test.expectedLevel, level)
				assert.Equal(t, test.expectedContext["ctx1"], ctx1)
				assert.Equal(t, test.expectedContext["ctx2"], ctx2)
			} else {
				assert.True(t, isRightLogFormat)
			}
		})
	}

	// Do a quick test of the WithGroup logger just for a sanity check.
	// WithGroup is simply WithContext under the covers so it should pass if the above tests pass.
	buf := &bytes.Buffer{}
	testlogger := WithGroup("testgroup").Output(buf)
	testlogger.Info().Msg("test group message")
	loggedMessage := buf.String()
	assert.True(t, isJSON(loggedMessage))
	var loggedMessageAsJson loggedMessageAsJsonStruct
	_ = json.Unmarshal([]byte(loggedMessage), &loggedMessageAsJson)
	assert.Equal(t, "test group message", loggedMessageAsJson.Message)
	assert.Equal(t, "info", loggedMessageAsJson.Level)
	assert.Equal(t, "testgroup", loggedMessageAsJson.Group)
	assert.Equal(t, "", loggedMessageAsJson.Ctx1)
	assert.Equal(t, "", loggedMessageAsJson.Ctx2)
}

func TestContextLoggerText(t *testing.T) {
	type logOutputTestStruct struct {
		expectedMessage string
		expectedLevel   string
		expectedContext map[string]string
	}

	tests := []logOutputTestStruct{
		{
			expectedMessage: "Kiali error logging test",
			expectedLevel:   "error",
			expectedContext: map[string]string{
				"ctx1": "foo",
				"ctx2": "bar",
			},
		},
		{
			expectedMessage: "Kiali warn logging test",
			expectedLevel:   "warn",
			expectedContext: map[string]string{
				"ctx1": "splat",
				"ctx2": "boo",
			},
		},
		{
			expectedMessage: "Kiali info logging test",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx1": "this-is-first",
				"ctx2": "this-is-second",
			},
		},
		{
			expectedMessage: "Kiali debug logging test",
			expectedLevel:   "debug",
			expectedContext: map[string]string{
				"ctx1": "number-1",
				"ctx2": "number-2",
			},
		},
		{
			expectedMessage: "Kiali trace logging test",
			expectedLevel:   "trace",
			expectedContext: map[string]string{
				"ctx1": "first",
				"ctx2": "second",
			},
		},
		{
			expectedMessage: "Kiali just first context",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx1": "just-one",
			},
		},
		{
			expectedMessage: "Kiali just second context",
			expectedLevel:   "info",
			expectedContext: map[string]string{
				"ctx2": "just-two",
			},
		},
		{
			expectedMessage: "Kiali no context",
			expectedLevel:   "info",
			expectedContext: map[string]string{},
		},
	}

	t.Setenv("LOG_LEVEL", "trace") // we want to test every level
	t.Setenv("LOG_FORMAT", "text")

	for index, test := range tests {
		t.Run(fmt.Sprintf("Test %d", index), func(t *testing.T) {
			buf := &bytes.Buffer{}
			log.Logger = InitializeLogger()
			ctx := log.Logger.With()
			for k, v := range test.expectedContext {
				ctx = ctx.Str(k, v)
			}
			testlogger := ctx.Logger()

			// we know this test should not use json
			if !isJsonLogFormat() {
				t.Logf("Overwrite logger for test %d", index)
				testlogger = testlogger.Output(zerolog.ConsoleWriter{Out: buf, TimeFormat: zerolog.TimeFieldFormat, NoColor: true})
			}

			switch test.expectedLevel {
			case "error":
				testlogger.Error().Msg(test.expectedMessage)
			case "warn":
				testlogger.Warn().Msg(test.expectedMessage)
			case "info":
				testlogger.Info().Msg(test.expectedMessage)
			case "debug":
				testlogger.Debug().Msg(test.expectedMessage)
			case "trace":
				testlogger.Trace().Msg(test.expectedMessage)
			default:
				testlogger.Error().Msg("Test provided a bad log level")
			}

			loggedMessage := buf.String()
			t.Logf("Logged message: %s", loggedMessage)

			isRightLogFormat := !isJSON(loggedMessage)
			if isRightLogFormat {
				level, message, ctx := parseTextLogLineWithContext(loggedMessage)
				assert.Contains(t, message, test.expectedMessage)
				assert.Equal(t, test.expectedLevel, level)
				assert.Equal(t, test.expectedContext["ctx1"], ctx["ctx1"])
				assert.Equal(t, test.expectedContext["ctx2"], ctx["ctx2"])
			} else {
				assert.True(t, isRightLogFormat)
			}
		})
	}

	// Do a quick test of the WithGroup logger just for a sanity check.
	// WithGroup is simply WithContext under the covers so it should pass if the above tests pass.
	buf := &bytes.Buffer{}
	testlogger := WithGroup("testgroup").Output(zerolog.ConsoleWriter{Out: buf, TimeFormat: zerolog.TimeFieldFormat, NoColor: true})
	testlogger.Info().Msg("test group message")
	loggedMessage := buf.String()
	assert.False(t, isJSON(loggedMessage))
	level, message, ctx := parseTextLogLineWithContext(loggedMessage)
	assert.Contains(t, message, "test group message")
	assert.Equal(t, "info", level)
	assert.Equal(t, "testgroup", ctx["group"])
	assert.Equal(t, "", ctx["ctx1"])
	assert.Equal(t, "", ctx["ctx2"])
}

func isJSON(s string) bool {
	var js map[string]interface{}
	return json.Unmarshal([]byte(s), &js) == nil
}

func isJsonLogFormat() bool {
	return os.Getenv("LOG_FORMAT") == "json"
}

func parseTextLogLineWithContext(line string) (level string, message string, context map[string]string) {
	// Supported log levels
	logLevels := []string{"TRC", "DBG", "INF", "WRN", "ERR"}
	logLevelNames := map[string]string{
		"TRC": "trace",
		"DBG": "debug",
		"INF": "info",
		"WRN": "warn",
		"ERR": "error",
	}

	// Find the log level
	for _, lvl := range logLevels {
		parts := strings.SplitN(line, " "+lvl+" ", 2)
		if len(parts) == 2 {
			level = logLevelNames[lvl]
			rest := parts[1]

			// Split the rest into message and key=value pairs
			tokens := strings.Fields(rest)
			context = make(map[string]string)
			msgParts := []string{}

			// Regex for key=value pattern
			kvRe := regexp.MustCompile(`^[^=]+=[^=]+$`)

			for _, token := range tokens {
				if kvRe.MatchString(token) {
					kv := strings.SplitN(token, "=", 2)
					context[kv[0]] = kv[1]
				} else {
					msgParts = append(msgParts, token)
				}
			}

			message = strings.Join(msgParts, " ")
			return
		}
	}

	// If no known level found, return empty values
	return "", "", nil
}

func TestWithLogLevel(t *testing.T) {
	tests := map[string]struct {
		inputLevel    string
		expectedLevel *zerolog.Level
	}{
		"valid debug level": {
			inputLevel:    "debug",
			expectedLevel: util.AsPtr(zerolog.DebugLevel),
		},
		"valid info level uppercase": {
			inputLevel:    "INFO",
			expectedLevel: util.AsPtr(zerolog.InfoLevel),
		},
		"valid trace level mixed case": {
			inputLevel:    "TrAcE",
			expectedLevel: util.AsPtr(zerolog.TraceLevel),
		},
		"invalid level": {
			inputLevel:    "invalid",
			expectedLevel: nil,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			cfg := &config{}
			option := WithLogLevel(tt.inputLevel)
			option(cfg)

			if tt.expectedLevel == nil {
				assert.Nil(cfg.logLevel, "Expected logLevel to be nil for invalid level")
			} else {
				assert.NotNil(cfg.logLevel, "Expected logLevel to be set")
				assert.Equal(*tt.expectedLevel, *cfg.logLevel, "Expected log level to match")
			}
		})
	}
}

func TestWithColor(t *testing.T) {
	assert := assert.New(t)
	cfg := &config{color: false}
	option := WithColor()
	option(cfg)

	assert.True(cfg.color, "Expected color to be enabled")
}

func TestInitializeLoggerWithOptions(t *testing.T) {
	tests := map[string]struct {
		options         []Option
		expectedLevel   zerolog.Level
		expectedColor   bool
		envLogLevel     string
		shouldUseEnvVar bool
	}{
		"with debug log level option": {
			options:       []Option{WithLogLevel("debug")},
			expectedLevel: zerolog.DebugLevel,
			expectedColor: false,
		},
		"with color option": {
			options:       []Option{WithColor()},
			expectedLevel: zerolog.InfoLevel,
			expectedColor: true,
		},
		"with both options": {
			options:       []Option{WithLogLevel("error"), WithColor()},
			expectedLevel: zerolog.ErrorLevel,
			expectedColor: true,
		},
		"option overrides env var": {
			options:         []Option{WithLogLevel("warn")},
			envLogLevel:     "trace",
			expectedLevel:   zerolog.WarnLevel,
			expectedColor:   false,
			shouldUseEnvVar: true,
		},
		"no options uses env var": {
			options:         []Option{},
			envLogLevel:     "debug",
			expectedLevel:   zerolog.DebugLevel,
			expectedColor:   false,
			shouldUseEnvVar: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			if tt.shouldUseEnvVar {
				t.Setenv("LOG_LEVEL", tt.envLogLevel)
			}
			t.Setenv("LOG_FORMAT", "json")

			buf := &bytes.Buffer{}
			logger := InitializeLogger(tt.options...).Output(buf)

			assert.Equal(tt.expectedLevel, zerolog.GlobalLevel(), "Expected global log level to match")

			logger.Debug().Msg("debug message")
			logger.Info().Msg("info message")
			logger.Error().Msg("error message")

			output := buf.String()
			lines := strings.Split(strings.TrimSpace(output), "\n")

			switch tt.expectedLevel {
			case zerolog.DebugLevel:
				assert.Equal(3, len(lines), "Expected 3 messages (debug, info, error)")
			case zerolog.InfoLevel:
				assert.Equal(2, len(lines), "Expected 2 messages (info, error)")
			case zerolog.WarnLevel:
				assert.Equal(1, len(lines), "Expected 1 message (error)")
			case zerolog.ErrorLevel:
				assert.Equal(1, len(lines), "Expected 1 message (error)")
			}
		})
	}
}

func TestTrimmedCallerMarshalFunc(t *testing.T) {
	tests := map[string]struct {
		filePath string
		line     int
		expected string
	}{
		"file within project root": {
			filePath: filepath.Join(pathutil.ProjectRoot, "models", "istio_validation.go"),
			line:     577,
			expected: "models/istio_validation.go:577",
		},
		"file within project root - config directory": {
			filePath: filepath.Join(pathutil.ProjectRoot, "config", "config.go"),
			line:     1490,
			expected: "config/config.go:1490",
		},
		"file within project root - nested directory": {
			filePath: filepath.Join(pathutil.ProjectRoot, "business", "checkers", "authorization.go"),
			line:     123,
			expected: "business/checkers/authorization.go:123",
		},
		"file outside project root": {
			filePath: "/some/other/path/external.go",
			line:     456,
			expected: "/some/other/path/external.go:456",
		},
		"file with project root as substring but not prefix": {
			filePath: "/other" + pathutil.ProjectRoot + "/file.go",
			line:     789,
			expected: "/other" + pathutil.ProjectRoot + "/file.go:789",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			result := trimmedCallerMarshalFunc(0, tt.filePath, tt.line)
			assert.Equal(tt.expected, result, "Expected trimmed path to match")
		})
	}
}

func TestRelativePathsInTraceLogs(t *testing.T) {
	t.Setenv("LOG_LEVEL", "trace")
	t.Setenv("LOG_FORMAT", "json")
	assert := assert.New(t)

	buf := &bytes.Buffer{}
	logger := InitializeLogger().Output(buf)

	_, currentFile, _, _ := runtime.Caller(0)
	expectedRelativePath := strings.TrimPrefix(currentFile, pathutil.ProjectRoot)
	expectedRelativePath = strings.TrimPrefix(expectedRelativePath, "/")

	logger.Trace().Msg("test trace message")

	output := buf.String()
	t.Logf("Logged output: %s", output)

	assert.Contains(output, expectedRelativePath, "Expected output to contain relative path")
	assert.NotContains(output, pathutil.ProjectRoot, "Expected output to not contain absolute project root path")

	var logEntry map[string]interface{}
	err := json.Unmarshal([]byte(output), &logEntry)
	assert.NoError(err, "Expected valid JSON output")

	caller, exists := logEntry["caller"]
	assert.True(exists, "Expected caller field to exist in trace logs")
	callerStr, ok := caller.(string)
	assert.True(ok, "Expected caller to be a string")
	assert.Contains(callerStr, "log_test.go:", "Expected caller to contain relative file path")
	assert.NotContains(callerStr, pathutil.ProjectRoot, "Expected caller to not contain absolute path")
}

func TestRelativePathsInTraceLogs_TextFormat(t *testing.T) {
	t.Setenv("LOG_LEVEL", "trace")
	t.Setenv("LOG_FORMAT", "text")
	assert := assert.New(t)
	buf := &bytes.Buffer{}
	logger := InitializeLogger().Output(zerolog.ConsoleWriter{
		Out:        buf,
		TimeFormat: time.RFC3339,
		NoColor:    true,
	})

	_, currentFile, _, _ := runtime.Caller(0)
	expectedRelativePath := strings.TrimPrefix(currentFile, pathutil.ProjectRoot)
	expectedRelativePath = strings.TrimPrefix(expectedRelativePath, "/")

	logger.Trace().Msg("test trace message in text format")

	output := buf.String()
	t.Logf("Logged output: %s", output)

	assert.Contains(output, expectedRelativePath, "Expected output to contain relative path")
	assert.NotContains(output, pathutil.ProjectRoot, "Expected output to not contain absolute project root path")
	assert.Contains(output, "test trace message in text format", "Expected output to contain the log message")
	assert.Contains(output, "log_test.go:", "Expected output to contain relative file path")
}
