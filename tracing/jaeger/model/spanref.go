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

import "github.com/kiali/kiali/log"

const (
	// ChildOf span reference type describes a reference to a parent span
	// that depends on the response from the current (child) span
	ChildOf = SpanRefType_CHILD_OF

	// FollowsFrom span reference type describes a reference to a "parent" span
	// that does not depend on the response from the current (child) span
	FollowsFrom = SpanRefType_FOLLOWS_FROM
)

// MaybeAddParentSpanID adds non-zero parentSpanID to refs as a child-of reference.
// We no longer store ParentSpanID in the domain model, but the data in the database
// or other formats might still have these IDs without representing them in the References,
// so this converts parent IDs to canonical reference format.
func MaybeAddParentSpanID(traceID TraceID, parentSpanID SpanID, refs []SpanRef) []SpanRef {
	if parentSpanID == 0 {
		return refs
	}
	for i := range refs {
		r := &refs[i]
		rTraceId := TraceID{}
		err := rTraceId.Unmarshal(r.TraceId)
		if err != nil {
			// On purpose to not propagate this error to the upper caller
			log.Warningf("jaeger TraceId unmarshall error: %v", err)
		}
		rSpanId, err := SpanIDFromBytes(r.SpanId)
		if err != nil {
			// On purpose to not propagate this error to the upper caller
			log.Warningf("jaeger SpanId unmarshall error: %v", err)
			rSpanId = 0
		}
		if rSpanId == parentSpanID && rTraceId == traceID {
			return refs
		}
	}
	bTraceId, bSpanId := marshallIds(traceID, parentSpanID)
	newRef := SpanRef{
		TraceId: bTraceId,
		SpanId:  bSpanId,
		RefType: ChildOf,
	}
	if len(refs) == 0 {
		return append(refs, newRef)
	}
	newRefs := make([]SpanRef, len(refs)+1)
	newRefs[0] = newRef
	copy(newRefs[1:], refs)
	return newRefs
}

// NewChildOfRef creates a new child-of span reference.
func NewChildOfRef(traceID TraceID, spanID SpanID) SpanRef {
	bTraceId, bSpanId := marshallIds(traceID, spanID)
	return SpanRef{
		RefType: ChildOf,
		TraceId: bTraceId,
		SpanId:  bSpanId,
	}
}

// NewFollowsFromRef creates a new follows-from span reference.
func NewFollowsFromRef(traceID TraceID, spanID SpanID) SpanRef {
	bTraceId, bSpanId := marshallIds(traceID, spanID)
	return SpanRef{
		RefType: FollowsFrom,
		TraceId: bTraceId,
		SpanId:  bSpanId,
	}
}

func marshallIds(traceID TraceID, spanID SpanID) ([]byte, []byte) {
	bTraceId := make([]byte, traceID.Size())
	bSpanId := make([]byte, spanID.Size())
	traceID.MarshalTo(bTraceId)
	spanID.MarshalTo(bSpanId)
	return bTraceId, bSpanId
}
