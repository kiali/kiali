package log

import (
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"os"
	"time"
)

// Configures the global log level and log format.
func InitializeLogger() {

	logTimeFieldFormat, isDefined := os.LookupEnv("LOG_TIME_FIELD_FORMAT")

	if !isDefined {
		logTimeFieldFormat = time.RFC3339
	}

	if os.Getenv("LOG_FORMAT") != "json" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: logTimeFieldFormat})
	} else {
		zerolog.TimeFieldFormat = logTimeFieldFormat
	}

	logLevel := resolveLogLevelFromEnv()
	zerolog.SetGlobalLevel(logLevel)
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
		logLevelFromString, err := zerolog.ParseLevel(logLevel)
		if err != nil {
			log.Warn().Msgf("Provided LOG_LEVEL %s is invalid. Fallback to info.", os.Getenv("LOG_LEVEL"))
			return zerolog.InfoLevel
		}
		return logLevelFromString
	}
}
