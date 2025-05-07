package log

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/hlog"
	"github.com/rs/zerolog/log"
)

type Format string

const (
	FallbackLogFormat       = "text"
	FallbackTimeFieldFormat = time.RFC3339
)

var supportedTimeFormats = [...]string{
	time.ANSIC,
	time.UnixDate,
	time.RubyDate,
	time.RFC822,
	time.RFC822Z,
	time.RFC850,
	time.RFC1123,
	time.RFC1123Z,
	time.RFC3339,
	time.RFC3339Nano,
	time.Kitchen,
	time.Stamp,
	time.StampMilli,
	time.StampMicro,
	time.StampNano,
}

// InitializeLogger configures the global log level and log format.
func InitializeLogger() zerolog.Logger {
	zerolog.TimeFieldFormat = resolveTimeFormatFromEnv()
	zerolog.TimestampFieldName = "ts" // save chars in the json output
	zerolog.MessageFieldName = "msg"  // save chars in the json output

	log.Logger = setLogFormat(setSamplingRate(log.Logger))

	logLevel := resolveLogLevelFromEnv()
	zerolog.SetGlobalLevel(logLevel)

	// set this logger as the default for when loggers are not found in a context
	zerolog.DefaultContextLogger = &log.Logger

	return log.Logger
}

func setSamplingRate(l zerolog.Logger) zerolog.Logger {
	logSamplerRateAsString, isSamplerRateDefined := os.LookupEnv("LOG_SAMPLER_RATE")
	if isSamplerRateDefined {
		logSamplerRate, err := strconv.Atoi(logSamplerRateAsString)
		if err != nil {
			log.Warn().Msgf("Provided sampling rate %s cannot be parsed to int32. "+
				"No sampling rate will be set. Error: %v", logSamplerRateAsString, err)
		} else if logSamplerRate != 1 {
			log.Debug().Msgf("Setting log sample rate to every %dth event", logSamplerRate)
			l = l.Sample(&zerolog.BasicSampler{N: uint32(logSamplerRate)})
		}
	}
	return l
}

func setLogFormat(l zerolog.Logger) zerolog.Logger {
	logFormat := resolveLogFormatFromEnv()
	if logFormat != "json" {
		l = l.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: resolveTimeFormatFromEnv(), NoColor: true})
	}
	return l
}

// WithGroup is a simple convienence function that provides a zerolog logger that will log messages associated with a group name in the log context
// Use this to obtain a logger that has only group name associated with it - there will be no associated data.
func WithGroup(group string) *zerolog.Logger {
	zl := log.With().Str("group", group).Logger()
	return &zl
}

// AddGroup is a convienence function that adds to the logger context a group name.
// Use this to retain the original logger context (and all its data) - you are simply adding a group to it.
func AddGroup(zl *zerolog.Logger, group string) *zerolog.Logger {
	newLogger := zl.With().Str("group", group).Logger()
	return &newLogger
}

// FromRequest is a convienence wrapper around zerolog's FromRequest thus helping callers avoid having to explicitly import hlog
func FromRequest(r *http.Request) *zerolog.Logger {
	return hlog.FromRequest(r)
}

// FromContext returns the logger from the given context. A base logger is returned if no logger exists in the context.
func FromContext(ctx context.Context) *zerolog.Logger {
	return zerolog.Ctx(ctx)
}

// ToContext stores the logger to the given context. If ctx is nil, an empty one is used.
func ToContext(ctx context.Context, zl *zerolog.Logger) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return zl.WithContext(ctx)
}

// Info logs a message via the global logger
func Info(args ...interface{}) {
	log.Info().Msgf("%s", args...)
}

// Infof logs a message via the global logger
func Infof(format string, args ...interface{}) {
	log.Info().Msgf(format, args...)
}

// Warning logs a warning message via the global logger
func Warning(args ...interface{}) {
	log.Warn().Msgf("%s", args...)
}

// Warningf logs a warning message via the global logger
func Warningf(format string, args ...interface{}) {
	log.Warn().Msgf(format, args...)
}

// Error logs an error message via the global logger
func Error(args ...interface{}) {
	log.Error().Msgf("%s", args...)
}

// Errorf logs an error message via the global logger
func Errorf(format string, args ...interface{}) {
	log.Error().Msgf(format, args...)
}

// Debug logs a debug message via the global logger
func Debug(args ...interface{}) {
	log.Debug().Msgf("%s", args...)
}

// Debugf logs a debug message via the global logger
func Debugf(format string, args ...interface{}) {
	log.Debug().Msgf(format, args...)
}

// IsDebug returns true if the global logger will actually log debug or trace level messages
func IsDebug() bool {
	return zerolog.GlobalLevel() == zerolog.DebugLevel
}

// Trace logs a trace message via the global logger
func Trace(args ...interface{}) {
	log.Trace().Msgf("%s", args...)
}

// Tracef logs a trace message via the global logger
func Tracef(format string, args ...interface{}) {
	log.Trace().Msgf(format, args...)
}

// IsTrace returns true if the global logger will actually log trace level messages
func IsTrace() bool {
	return zerolog.GlobalLevel() == zerolog.TraceLevel
}

// Fatal logs a fatal message via the global logger
func Fatal(args ...interface{}) {
	log.Fatal().Msgf("%s", args...)
}

// Fatalf logs a fatal message via the global logger
func Fatalf(format string, args ...interface{}) {
	log.Fatal().Msgf(format, args...)
}

// GetLogLevel will return the level of logs the global logger will output.
func GetLogLevel() string {
	return zerolog.GlobalLevel().String()
}

// resolveLogLevelFromEnv resolves the environment settings for the log level. Considers the verbose_mode from server version <=1.25.
func resolveLogLevelFromEnv() zerolog.Level {
	logLevel, isDefined := os.LookupEnv("LOG_LEVEL")

	if !isDefined {
		return zerolog.InfoLevel
	}

	logLevelFromString, err := zerolog.ParseLevel(strings.ToLower(logLevel))
	if err != nil {
		log.Warn().Msgf("Provided LOG_LEVEL [%s] is invalid. Falling back to 'info'.", os.Getenv("LOG_LEVEL"))
		return zerolog.InfoLevel
	}
	return logLevelFromString
}

// resolveLogFormatFromEnv resolves and validates the log format. FallbackLogFormat is used as a default.
func resolveLogFormatFromEnv() string {
	logFormatEnv, isDefined := os.LookupEnv("LOG_FORMAT")

	if !isDefined {
		return FallbackLogFormat
	}

	switch logFormatEnv {
	case "text", "json":
		return logFormatEnv
	default:
		Warningf("Provided LOG_FORMAT %s is invalid. Fallback to text.", logFormatEnv)
		return FallbackLogFormat
	}
}

// resolveTimeFormatFromEnv resolves and validates the provided log time format. FallbackTimeFieldFormat is used as a fallback.
func resolveTimeFormatFromEnv() string {
	logTimeFieldFormat, isDefined := os.LookupEnv("LOG_TIME_FIELD_FORMAT")

	if !isDefined {
		return FallbackTimeFieldFormat
	}

	for _, supportedTimeFormat := range supportedTimeFormats {
		if logTimeFieldFormat == supportedTimeFormat {
			return logTimeFieldFormat
		}
	}

	Warningf("Provided LOG_TIME_FIELD_FORMAT %s is not supported. Fallback to %s", logTimeFieldFormat, FallbackTimeFieldFormat)
	return FallbackTimeFieldFormat
}
