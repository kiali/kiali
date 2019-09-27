package log

// LogAdapter is an adapter to any backed logger
type LogAdapter struct {
	Errorf   func(string, ...interface{})
	Warningf func(string, ...interface{})
	Infof    func(string, ...interface{})
	Tracef   func(string, ...interface{})
}

type SafeAdapter = LogAdapter

func NewSafeAdapter(from LogAdapter) SafeAdapter {
	safe := SafeAdapter{}
	// Default to noop
	lastFunc := func(string, ...interface{}) {}
	if from.Tracef != nil {
		lastFunc = from.Tracef
	}
	safe.Tracef = lastFunc
	if from.Infof != nil {
		lastFunc = from.Infof
	}
	safe.Infof = lastFunc
	if from.Warningf != nil {
		lastFunc = from.Warningf
	}
	safe.Warningf = lastFunc
	if from.Errorf != nil {
		lastFunc = from.Errorf
	}
	safe.Errorf = lastFunc
	return safe
}
