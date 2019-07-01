// Copyright 2019 The Prometheus Authors
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

package procfs

import (
	"reflect"
	"testing"
)

func TestVM(t *testing.T) {
	fs, err := NewFS(procTestFixtures)
	if err != nil {
		t.Fatal(err)
	}
	stats, err := fs.VM()
	if err != nil {
		t.Fatal(err)
	}

	lowmemreserveratio := []int64{256, 256, 32, 0, 0}
	vm := &VM{
		AdminReserveKbytes:        8192,
		CompactUnevictableAllowed: 1,
		DirtyBackgroundRatio:      10,
		DirtyExpireCentisecs:      3000,
		DirtyRatio:                20,
		DirtytimeExpireSeconds:    43200,
		DirtyWritebackCentisecs:   500,
		ExtfragThreshold:          500,
		LaptopMode:                5,
		LowmemReserveRatio:        lowmemreserveratio,
		MaxMapCount:               65530,
		MemoryFailureRecovery:     1,
		MinFreeKbytes:             67584,
		MinSlabRatio:              5,
		MinUnmappedRatio:          1,
		MmapMinAddr:               65536,
		NumaStat:                  1,
		NumaZonelistOrder:         "Node",
		OomDumpTasks:              1,
		OvercommitRatio:           50,
		PageCluster:               3,
		StatInterval:              1,
		Swappiness:                60,
		UserReserveKbytes:         131072,
		VfsCachePressure:          100,
		WatermarkBoostFactor:      15000,
		WatermarkScaleFactor:      10,
	}
	if !reflect.DeepEqual(vm, stats) {
		t.Errorf("Result not correct: want %v\n, have %v", vm, stats)
	}
}
