package log

import (
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

// ContextLogger will provide a logger that contains additional structured data that will be logged with each message
type ContextLogger struct {
	Z zerolog.Logger
}

// WithContext provides a logger that will log messages that are associated with some structured content provided in the map
func WithContext(fields map[string]string) ContextLogger {
	ctx := log.Logger.With()
	for k, v := range fields {
		ctx = ctx.Str(k, v)
	}
	cl := ContextLogger{Z: setLogFormat(setSamplingRate(ctx.Logger()))}
	return cl
}

// WithGroup is a simple convienence function that provides a logger that will log messages associated with a group name in the log context
func WithGroup(group string) ContextLogger {
	return WithContext(map[string]string{"group": group})
}

// FromRequest is a convienence wrapper around zerolog's FromRequest thus helping callers avoid having to explicitly import hlog
func FromRequest(r *http.Request) *zerolog.Logger {
	return hlog.FromRequest(r)
}

// Info logs a message via the global logger
func Info(args ...interface{}) {
	log.Info().Msgf("%s", args...)
}

// Infof logs a message via the global logger
func Infof(format string, args ...interface{}) {
	log.Info().Msgf(format, args...)
}

// Info logs a message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Info(args ...interface{}) {
	c.Z.Info().Msgf("%s", args...)
}

// Infof logs a message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Infof(format string, args ...interface{}) {
	c.Z.Info().Msgf(format, args...)
}

// Warning logs a warning message via the global logger
func Warning(args ...interface{}) {
	log.Warn().Msgf("%s", args...)
}

// Warningf logs a warning message via the global logger
func Warningf(format string, args ...interface{}) {
	log.Warn().Msgf(format, args...)
}

// Warning logs a warning message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Warning(args ...interface{}) {
	c.Z.Warn().Msgf("%s", args...)
}

// Warningf logs a warning message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Warningf(format string, args ...interface{}) {
	c.Z.Warn().Msgf(format, args...)
}

// Error logs an error message via the global logger
func Error(args ...interface{}) {
	log.Error().Msgf("%s", args...)
}

// Errorf logs an error message via the global logger
func Errorf(format string, args ...interface{}) {
	log.Error().Msgf(format, args...)
}

// Error logs an error message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Error(args ...interface{}) {
	c.Z.Error().Msgf("%s", args...)
}

// Errorf logs an error message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Errorf(format string, args ...interface{}) {
	c.Z.Error().Msgf(format, args...)
}

// Debug logs a debug message via the global logger
func Debug(args ...interface{}) {
	log.Debug().Msgf("%s", args...)
}

// Debugf logs a debug message via the global logger
func Debugf(format string, args ...interface{}) {
	log.Debug().Msgf(format, args...)
}

// Debug logs a debug message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Debug(args ...interface{}) {
	c.Z.Debug().Msgf("%s", args...)
}

// Debugf logs a debug message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Debugf(format string, args ...interface{}) {
	c.Z.Debug().Msgf(format, args...)
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

// Trace logs a trace message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Trace(args ...interface{}) {
	c.Z.Trace().Msgf("%s", args...)
}

// Tracef logs a trace message via a context logger such that the message will be associated with structured data in the context
func (c ContextLogger) Tracef(format string, args ...interface{}) {
	c.Z.Trace().Msgf(format, args...)
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
