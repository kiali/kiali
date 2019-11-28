// Copyright (c) 2019 Uber Technologies, Inc.
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

import * as React from 'react';
import { Upload, Icon } from 'antd';

const Dragger = Upload.Dragger;

type FileLoaderProps = {
  loadJsonTraces: (fileList: FileList) => void;
};

export default function FileLoader(props: FileLoaderProps) {
  return (
    <Dragger accept=".json" customRequest={props.loadJsonTraces} multiple>
      <p className="ant-upload-drag-icon">
        <Icon type="file-add" />
      </p>
      <p className="ant-upload-text">Click or drag files to this area.</p>
      <p className="ant-upload-hint">JSON files containing one or more traces are supported.</p>
    </Dragger>
  );
}
