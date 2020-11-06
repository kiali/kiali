package config_dump

import (
	"bytes"
	"reflect"
	"strings"

	adminapi "github.com/envoyproxy/go-control-plane/envoy/admin/v3"
	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"github.com/golang/protobuf/ptypes/any"
	emptypb "github.com/golang/protobuf/ptypes/empty"
	exprpb "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

type anyresolver struct{}

var resolver anyresolver

// Needed to implement to avoid breaking when specific messages are not found
func (ar anyresolver) Resolve(typeURL string) (proto.Message, error) {
	mtype := typeURL

	if parts := strings.Split(typeURL, "/"); len(parts) > 0 {
		mtype = parts[len(parts)-1]
	}

	mt := proto.MessageType(mtype)
	if mt == nil {
		return &exprpb.Type{TypeKind: &exprpb.Type_Dyn{Dyn: &emptypb.Empty{}}}, nil
	}
	return reflect.New(mt.Elem()).Interface().(proto.Message), nil
}

type ConfigDump struct {
	*adminapi.ConfigDump
}

// UnmarshalJSON is a custom unmarshaller to handle protobuf pain
func (w *ConfigDump) UnmarshalJSON(b []byte) error {
	cd := &adminapi.ConfigDump{}
	err := (&jsonpb.Unmarshaler{
		AllowUnknownFields: true,
		AnyResolver:        &resolver,
	}).Unmarshal(bytes.NewReader(b), cd)
	*w = ConfigDump{cd}
	return err
}

func (w *ConfigDump) GetConfig(msgType string) *any.Any {
	for _, config := range w.Configs {
		if config.TypeUrl == msgType {
			return config
		}
	}
	return nil
}
