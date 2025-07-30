package path

import (
	"path"
	"path/filepath"
	"runtime"
)

var (
	// Adapted from: https://stackoverflow.com/a/38644571
	_, b, _, _ = runtime.Caller(0)
	basepath   = filepath.Dir(b)
	// ProjectRoot is the root directory of the project.
	// This works so long as the current dir structure stays the same.
	// This should be the base of the project e.g. '/home/user1/kiali'.
	// If the location of this file changes, this needs to be updated as well.
	ProjectRoot = path.Dir(path.Dir(basepath))
)
