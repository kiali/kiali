// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Cloned from github.com/jaegertracing/jaeger/

// nolint
package model

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strconv"
)

// These constants are kept mostly for backwards compatibility.
const (
	// StringType indicates the value is a unicode string
	StringType = ValueType_STRING
	// BoolType indicates the value is a Boolean encoded as int64 number 0 or 1
	BoolType = ValueType_BOOL
	// Int64Type indicates the value is an int64 number
	Int64Type = ValueType_INT64
	// Float64Type indicates the value is a float64 number stored as int64
	Float64Type = ValueType_FLOAT64
	// BinaryType indicates the value is binary blob stored as a byte array
	BinaryType = ValueType_BINARY
)

// KeyValues is a type alias that exposes convenience functions like Sort, FindByKey.
type KeyValues []*KeyValue

// String creates a String-typed KeyValue
func String(key string, value string) KeyValue {
	return KeyValue{Key: key, VType: StringType, VStr: value}
}

// Bool creates a Bool-typed KeyValue
func Bool(key string, value bool) KeyValue {
	return KeyValue{Key: key, VType: BoolType, VBool: value}
}

// Int64 creates a Int64-typed KeyValue
func Int64(key string, value int64) KeyValue {
	return KeyValue{Key: key, VType: Int64Type, VInt64: value}
}

// Float64 creates a Float64-typed KeyValue
func Float64(key string, value float64) KeyValue {
	return KeyValue{Key: key, VType: Float64Type, VFloat64: value}
}

// Binary creates a Binary-typed KeyValue
func Binary(key string, value []byte) KeyValue {
	return KeyValue{Key: key, VType: BinaryType, VBinary: value}
}

// Bool returns the Boolean value stored in this KeyValue or false if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Bool() bool {
	if kv.VType == BoolType {
		return kv.VBool
	}
	return false
}

// Int64 returns the Int64 value stored in this KeyValue or 0 if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Int64() int64 {
	if kv.VType == Int64Type {
		return kv.VInt64
	}
	return 0
}

// Float64 returns the Float64 value stored in this KeyValue or 0 if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Float64() float64 {
	if kv.VType == Float64Type {
		return kv.VFloat64
	}
	return 0
}

// Binary returns the blob ([]byte) value stored in this KeyValue or nil if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Binary() []byte {
	if kv.VType == BinaryType {
		return kv.VBinary
	}
	return nil
}

// Value returns typed values stored in KeyValue as interface{}.
func (kv *KeyValue) Value() interface{} {
	switch kv.VType {
	case StringType:
		return kv.VStr
	case BoolType:
		return kv.VBool
	case Int64Type:
		return kv.VInt64
	case Float64Type:
		return kv.VFloat64
	case BinaryType:
		return kv.VBinary
	default:
		return fmt.Errorf("unknown type %d", kv.VType)
	}
}

// AsStringLossy returns a potentially lossy string representation of the value.
func (kv *KeyValue) AsStringLossy() string {
	return kv.asString(true)
}

// AsString returns a string representation of the value.
func (kv *KeyValue) AsString() string {
	return kv.asString(false)
}

func (kv *KeyValue) asString(truncate bool) string {
	switch kv.VType {
	case StringType:
		return kv.VStr
	case BoolType:
		if kv.Bool() {
			return "true"
		}
		return "false"
	case Int64Type:
		return strconv.FormatInt(kv.Int64(), 10)
	case Float64Type:
		return strconv.FormatFloat(kv.Float64(), 'g', 10, 64)
	case BinaryType:
		if truncate && len(kv.VBinary) > 256 {
			return hex.EncodeToString(kv.VBinary[0:256]) + "..."
		}
		return hex.EncodeToString(kv.VBinary)
	default:
		return fmt.Sprintf("unknown type %d", kv.VType)
	}
}

// IsLess compares KeyValue object with another KeyValue.
// The order is based first on the keys, then on type, and finally on the value.
func (kv *KeyValue) IsLess(two *KeyValue) bool {
	return KeyValueCompare(kv, two) < 0
}

func (kvs KeyValues) Len() int      { return len(kvs) }
func (kvs KeyValues) Swap(i, j int) { kvs[i], kvs[j] = kvs[j], kvs[i] }
func (kvs KeyValues) Less(i, j int) bool {
	return kvs[i].IsLess(kvs[j])
}

// Sort does in-place sorting of KeyValues, then by value type, then by value.
func (kvs KeyValues) Sort() {
	sort.Sort(kvs)
}

// FindByKey scans the list of key-values searching for the first one with the given key.
// Returns found tag and a boolean flag indicating if the search was successful.
func (kvs KeyValues) FindByKey(key string) (*KeyValue, bool) {
	for _, kv := range kvs {
		if kv.Key == key {
			return kv, true
		}
	}
	return &KeyValue{}, false
}

// Equal compares KeyValues with another list. Both lists must be already sorted.
func (kvs KeyValues) Equal(other KeyValues) bool {
	l1, l2 := len(kvs), len(other)
	if l1 != l2 {
		return false
	}
	for i := 0; i < l1; i++ {
		if !kvs[i].Equal(&other[i]) {
			return false
		}
	}
	return true
}

// Hash implements Hash from Hashable.
func (kvs KeyValues) Hash(w io.Writer) error {
	for i := range kvs {
		if err := kvs[i].Hash(w); err != nil {
			return err
		}
	}
	return nil
}

// Hash implements Hash from Hashable.
func (kv KeyValue) Hash(w io.Writer) error {
	if _, err := w.Write([]byte(kv.Key)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.BigEndian, uint16(kv.VType)); err != nil {
		return err
	}
	var err error
	switch kv.VType {
	case StringType:
		_, err = w.Write([]byte(kv.VStr))
	case BoolType:
		err = binary.Write(w, binary.BigEndian, kv.VBool)
	case Int64Type:
		err = binary.Write(w, binary.BigEndian, kv.VInt64)
	case Float64Type:
		err = binary.Write(w, binary.BigEndian, kv.VFloat64)
	case BinaryType:
		_, err = w.Write(kv.VBinary)
	default:
		err = fmt.Errorf("unknown type %d", kv.VType)
	}
	return err
}

func KeyValueCompare(this *KeyValue, that interface{}) int {
	if that == nil {
		if this == nil {
			return 0
		}
		return 1
	}

	that1, ok := that.(*KeyValue)
	if !ok {
		that2, ok := that.(KeyValue)
		if ok {
			that1 = &that2
		} else {
			return 1
		}
	}
	if that1 == nil {
		if this == nil {
			return 0
		}
		return 1
	} else if this == nil {
		return -1
	}
	if this.Key != that1.Key {
		if this.Key < that1.Key {
			return -1
		}
		return 1
	}
	if this.VType != that1.VType {
		if this.VType < that1.VType {
			return -1
		}
		return 1
	}
	if this.VStr != that1.VStr {
		if this.VStr < that1.VStr {
			return -1
		}
		return 1
	}
	if this.VBool != that1.VBool {
		if !this.VBool {
			return -1
		}
		return 1
	}
	if this.VInt64 != that1.VInt64 {
		if this.VInt64 < that1.VInt64 {
			return -1
		}
		return 1
	}
	if this.VFloat64 != that1.VFloat64 {
		if this.VFloat64 < that1.VFloat64 {
			return -1
		}
		return 1
	}
	if c := bytes.Compare(this.VBinary, that1.VBinary); c != 0 {
		return c
	}
	return 0
}
func (this *KeyValue) Equal(that interface{}) bool {
	if that == nil {
		return this == nil
	}

	that1, ok := that.(*KeyValue)
	if !ok {
		that2, ok := that.(KeyValue)
		if ok {
			that1 = &that2
		} else {
			return false
		}
	}
	if that1 == nil {
		return this == nil
	} else if this == nil {
		return false
	}
	if this.Key != that1.Key {
		return false
	}
	if this.VType != that1.VType {
		return false
	}
	if this.VStr != that1.VStr {
		return false
	}
	if this.VBool != that1.VBool {
		return false
	}
	if this.VInt64 != that1.VInt64 {
		return false
	}
	if this.VFloat64 != that1.VFloat64 {
		return false
	}
	if !bytes.Equal(this.VBinary, that1.VBinary) {
		return false
	}
	return true
}
