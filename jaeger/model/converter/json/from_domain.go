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
package json

import (
	"strings"

	"github.com/kiali/kiali/jaeger/model"
	"github.com/kiali/kiali/jaeger/model/json"
	"github.com/kiali/kiali/log"
)

// FromDomain converts model.Trace into json.Trace format.
// It assumes that the domain model is valid, namely that all enums
// have valid values, so that it does not need to check for errors.
func FromDomain(trace *model.Trace) *json.Trace {
	fd := fromDomain{}
	fd.convertKeyValuesFunc = fd.convertKeyValues
	return fd.fromDomain(trace)
}

// FromDomainEmbedProcess converts model.Span into json.Span format.
// This format includes a ParentSpanID and an embedded Process.
func FromDomainEmbedProcess(span *model.Span) *json.Span {
	fd := fromDomain{}
	fd.convertKeyValuesFunc = fd.convertKeyValuesString
	return fd.convertSpanEmbedProcess(span)
}

type fromDomain struct {
	convertKeyValuesFunc func(keyValues model.KeyValues) []json.KeyValue
}

func (fd fromDomain) fromDomain(trace *model.Trace) *json.Trace {
	jSpans := make([]json.Span, len(trace.Spans))
	processes := &processHashtable{}
	var traceID json.TraceID
	for i, span := range trace.Spans {
		if i == 0 {
			traceId := model.TraceID{}
			traceId.Unmarshal(span.TraceId)
			traceID = json.TraceID(traceId.String())
		}
		processID := json.ProcessID(processes.getKey(span.Process))
		jSpans[i] = fd.convertSpan(span, processID)
	}
	jTrace := &json.Trace{
		TraceID:   traceID,
		Spans:     jSpans,
		Processes: fd.convertProcesses(processes.getMapping()),
		Warnings:  trace.Warnings,
	}
	return jTrace
}

func (fd fromDomain) convertSpanInternal(span *model.Span) json.Span {
	traceId := model.TraceID{}
	traceId.Unmarshal(span.TraceId)
	spanId, err := model.SpanIDFromBytes(span.SpanId)
	if err != nil {
		// On purpose to not propagate this error to the upper caller
		log.Warningf("jaeger SpanId unmarshall error: %v", err)
		spanId = 0
	}
	return json.Span{
		TraceID:       json.TraceID(traceId.String()),
		SpanID:        json.SpanID(spanId.String()),
		Flags:         uint32(span.Flags),
		OperationName: span.OperationName,
		StartTime:     model.TimeAsEpochMicroseconds(span.StartTime.AsTime()),
		Duration:      model.DurationAsMicroseconds(span.Duration.AsDuration()),
		Tags:          fd.convertKeyValues(span.Tags),
		Logs:          fd.convertLogs(span.Logs),
	}
}

func (fd fromDomain) convertSpan(span *model.Span, processID json.ProcessID) json.Span {
	s := fd.convertSpanInternal(span)
	s.ProcessID = processID
	s.Warnings = span.Warnings
	s.References = fd.convertReferences(span)
	return s
}

func (fd fromDomain) convertSpanEmbedProcess(span *model.Span) *json.Span {
	s := fd.convertSpanInternal(span)
	process := fd.convertProcess(span.Process)
	s.Process = &process
	s.References = fd.convertReferences(span)
	return &s
}

func (fd fromDomain) convertReferences(span *model.Span) []json.Reference {
	out := make([]json.Reference, 0, len(span.References))
	for _, ref := range span.References {
		traceId := model.TraceID{}
		traceId.Unmarshal(ref.TraceId)
		spanId, err := model.SpanIDFromBytes(ref.SpanId)
		if err != nil {
			// On purpose to not propagate this error to the upper caller
			log.Warningf("jaeger SpanId unmarshall error: %v", err)
			spanId = 0
		}
		out = append(out, json.Reference{
			RefType: fd.convertRefType(ref.RefType),
			TraceID: json.TraceID(traceId.String()),
			SpanID:  json.SpanID(spanId.String()),
		})
	}
	return out
}

func (fd fromDomain) convertRefType(refType model.SpanRefType) json.ReferenceType {
	if refType == model.FollowsFrom {
		return json.FollowsFrom
	}
	return json.ChildOf
}

func (fd fromDomain) convertKeyValues(keyValues model.KeyValues) []json.KeyValue {
	out := make([]json.KeyValue, len(keyValues))
	for i, kv := range keyValues {
		var value interface{}
		switch kv.VType {
		case model.StringType:
			value = kv.VStr
		case model.BoolType:
			value = kv.Bool()
		case model.Int64Type:
			value = kv.Int64()
		case model.Float64Type:
			value = kv.Float64()
		case model.BinaryType:
			value = kv.Binary()
		}

		out[i] = json.KeyValue{
			Key:   kv.Key,
			Type:  json.ValueType(strings.ToLower(kv.VType.String())),
			Value: value,
		}
	}
	return out
}

func (fd fromDomain) convertKeyValuesString(keyValues model.KeyValues) []json.KeyValue {
	out := make([]json.KeyValue, len(keyValues))
	for i, kv := range keyValues {
		out[i] = json.KeyValue{
			Key:   kv.Key,
			Type:  json.ValueType(strings.ToLower(kv.VType.String())),
			Value: kv.AsString(),
		}
	}
	return out
}

func (fd fromDomain) convertLogs(logs []*model.Log) []json.Log {
	out := make([]json.Log, len(logs))
	for i, log := range logs {
		out[i] = json.Log{
			Timestamp: model.TimeAsEpochMicroseconds(log.Timestamp.AsTime()),
			Fields:    fd.convertKeyValuesFunc(log.Fields),
		}
	}
	return out
}

func (fd fromDomain) convertProcesses(processes map[string]*model.Process) map[json.ProcessID]json.Process {
	out := make(map[json.ProcessID]json.Process)
	for key, process := range processes {
		out[json.ProcessID(key)] = fd.convertProcess(process)
	}
	return out
}

func (fd fromDomain) convertProcess(process *model.Process) json.Process {
	return json.Process{
		ServiceName: process.ServiceName,
		Tags:        fd.convertKeyValuesFunc(process.Tags),
	}
}

// DependenciesFromDomain converts []model.DependencyLink into []json.DependencyLink format.
func DependenciesFromDomain(dependencyLinks []model.DependencyLink) []json.DependencyLink {
	retMe := make([]json.DependencyLink, 0, len(dependencyLinks))
	for _, dependencyLink := range dependencyLinks {
		retMe = append(
			retMe,
			json.DependencyLink{
				Parent:    dependencyLink.Parent,
				Child:     dependencyLink.Child,
				CallCount: dependencyLink.CallCount,
			},
		)
	}
	return retMe
}
