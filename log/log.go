package log

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
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

// Configures the global log level and log format.
func InitializeLogger() zerolog.Logger {
	zerolog.TimeFieldFormat = resolveTimeFormatFromEnv()

	logSamplerRateAsString, isSamplerRateDefined := os.LookupEnv("LOG_SAMPLER_RATE")
	if isSamplerRateDefined {
		logSamplerRate, err := strconv.Atoi(logSamplerRateAsString)
		if err != nil {
			log.Warn().Msgf("Provided sampling rate %s cannot be parsed to int32. "+
				"No sampling rate will be set. Error: %v", logSamplerRateAsString, err)
		} else if logSamplerRate != 1 {
			log.Debug().Msgf("Setting log sample rate to every %dth event", logSamplerRate)
			log.Logger = log.Sample(&zerolog.BasicSampler{N: uint32(logSamplerRate)})
		}
	}

	logFormat := resolveLogFormatFromEnv()
	if logFormat != "json" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: zerolog.TimeFieldFormat, NoColor: true})
	}

	logLevel := resolveLogLevelFromEnv()
	zerolog.SetGlobalLevel(logLevel)

	return log.Logger
}

func Info(args ...interface{}) {
	log.Info().Msgf("%s", args...)
}

func Infof(format string, args ...interface{}) {
	log.Info().Msgf(format, args...)
}

func Warning(args ...interface{}) {
	log.Warn().Msgf("%s", args...)
}

func Warningf(format string, args ...interface{}) {
	log.Warn().Msgf(format, args...)
}

func Error(args ...interface{}) {
	log.Error().Msgf("%s", args...)
}

func Errorf(format string, args ...interface{}) {
	log.Error().Msgf(format, args...)
}

func Debug(args ...interface{}) {
	log.Debug().Msgf("%s", args...)
}

func Debugf(format string, args ...interface{}) {
	log.Debug().Msgf(format, args...)
}

func IsDebug() bool {
	return zerolog.GlobalLevel() == zerolog.DebugLevel
}

func Trace(args ...interface{}) {
	log.Trace().Msgf("%s", args...)
}

func Tracef(format string, args ...interface{}) {
	log.Trace().Msgf(format, args...)
}

func IsTrace() bool {
	return zerolog.GlobalLevel() == zerolog.TraceLevel
}

func Fatal(args ...interface{}) {
	log.Fatal().Msgf("%s", args...)
}

func Fatalf(format string, args ...interface{}) {
	log.Fatal().Msgf(format, args...)
}

// Return log level
// Used to get debug info
func GetLogLevel() string {
	return zerolog.GlobalLevel().String()
}

// Resolves the environment settings for the log level. Considers the verbose_mode from server version <=1.25.
func resolveLogLevelFromEnv() zerolog.Level {
	logLevel, isDefined := os.LookupEnv("LOG_LEVEL")

	if !isDefined {
		return zerolog.InfoLevel
	}

	switch logLevel {
	case "0":
		return zerolog.FatalLevel
	case "1":
		return zerolog.ErrorLevel
	case "2":
		return zerolog.WarnLevel
	case "3":
		return zerolog.InfoLevel
	case "4":
		return zerolog.DebugLevel
	case "5":
		return zerolog.TraceLevel
	default:
		logLevelFromString, err := zerolog.ParseLevel(strings.ToLower(logLevel))
		if err != nil {
			log.Warn().Msgf("Provided LOG_LEVEL %s is invalid. Fallback to info.", os.Getenv("LOG_LEVEL"))
			return zerolog.InfoLevel
		}
		return logLevelFromString
	}
}

// Resolves and validates the log format. FallbackLogFormat is used as a default.
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

// Resolves and validates the provided log time format. FallbackTimeFieldFormat is used as a fallback.
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
