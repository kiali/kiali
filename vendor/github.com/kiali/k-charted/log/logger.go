package log

// LogAdapter is an adapter to any backed logger
type LogAdapter struct {
	Errorf   func(string, ...interface{})
	Warningf func(string, ...interface{})
	Infof    func(string, ...interface{})
	Tracef   func(string, ...interface{})
}

type SafeAdapter = LogAdapter

func noop(string, ...interface{}) {}

func NewSafeAdapter(from LogAdapter) SafeAdapter {
	safe := SafeAdapter{
		Errorf:   noop,
		Warningf: noop,
		Infof:    noop,
		Tracef:   noop,
	}
	if from.Errorf != nil {
		safe.Errorf = from.Errorf
	}
	if from.Warningf != nil {
		safe.Warningf = from.Warningf
	}
	if from.Infof != nil {
		safe.Infof = from.Infof
	}
	if from.Tracef != nil {
		safe.Tracef = from.Tracef
	}
	return safe
}
