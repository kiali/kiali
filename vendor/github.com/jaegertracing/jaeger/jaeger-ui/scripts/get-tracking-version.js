#!/usr/bin/env node

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

// See the comment on `getVersion(..)` for details on what this script does.

const spawnSync = require('child_process').spawnSync;

const version = require('../package.json').version;

function cleanRemoteUrl(url) {
  return url.replace(/^(.*?@|.*?\/\/)|\.git\s*$/gi, '').replace(/:/g, '/');
}

function cleanBranchNames(pointsAt) {
  const branch = pointsAt.replace(/"/g, '').split('\n')[0];
  const i = branch.indexOf(' ');
  const objName = branch.slice(0, i);
  let refName = branch.slice(i + 1);
  if (refName.indexOf('detached') > -1) {
    refName = '(detached)';
  }
  return { objName, refName };
}

function getChanged(shortstat, status) {
  const rv = { hasChanged: false, files: 0, insertions: 0, deletions: 0, untracked: 0 };
  const joiner = [];
  const regex = /(\d+) (.)/g;
  let match = regex.exec(shortstat);
  while (match) {
    const [, n, type] = match;
    switch (type) {
      case 'f':
        rv.files = Number(n);
        joiner.push(`${n}f`);
        break;
      case 'i':
        rv.insertions = Number(n);
        joiner.push(`+${n}`);
        break;
      case 'd':
        rv.deletions = Number(n);
        joiner.push(`-${n}`);
        break;
      default:
        throw new Error(`Invalid diff type: ${type}`);
    }
    match = regex.exec(shortstat);
  }
  const untracked = status && status.split('\n').filter(line => line[0] === '?').length;
  if (untracked) {
    rv.untracked = untracked;
    joiner.push(`${untracked}?`);
  }
  rv.pretty = joiner.join(' ');
  rv.hasChanged = Boolean(joiner.length);
  return rv;
}

// This util function, which can be used via the CLI or as a module, outputs
// a JSON blob indicating the git state of a repo. It defaults to checking the
// repo at ".", but accepts a working directory.
//
// The output is along the lines of the following:
//
//     {
//       "version": "0.0.1",
//       "remote": "github.com/jaegertracing/jaeger-ui",
//       "objName": "64fbc13",
//       "changed": {
//         "hasChanged": true,
//         "files": 1,
//         "insertions": 21,
//         "deletions": 0,
//         "untracked": 0,
//         "pretty": "1f +21"
//       },
//       "refName": "issue-39-track-js-errors",
//       "pretty": "0.0.1 | github.com/jaegertracing/jaeger-ui | 64fbc13 | 1f +21 | issue-39-track-js-errors"
//     }
//
// * version: The package.json version
// * remote: The git remote URL (normalized)
// * objName: The short SHA
// * changed: Indicates any changes in the repo
//     * changed.pretty: formatted as "2f +3 -4 5?", which indicates two modified
//       files having three insertions, 4 deletions, and 5 untracked files
// * refName: The name of the current branch, "(detached)" when the head is detached
// * pretty: A human-readable representation of the above fields
function getVersion(cwd) {
  const opts = { cwd, encoding: 'utf8' };
  const url = spawnSync('git', ['remote', 'get-url', '--push', 'origin'], opts).stdout;
  const branch = spawnSync(
    'git',
    ['branch', '--points-at', 'HEAD', '--format="%(objectname:short) %(refname:short)"'],
    opts
  ).stdout;
  const shortstat = spawnSync('git', ['diff-index', '--shortstat', 'HEAD'], opts).stdout;
  const status = spawnSync('git', ['status', '--porcelain', '-uall'], opts).stdout;

  const { objName, refName } = cleanBranchNames(branch);
  const remote = cleanRemoteUrl(url);
  const joiner = [version, remote, objName];
  const changed = getChanged(shortstat, status);
  if (changed.hasChanged) {
    joiner.push(changed.pretty);
  }
  joiner.push(refName);
  const rv = {
    version,
    remote,
    objName,
    changed,
    refName,
    pretty: joiner.join(' | '),
  };
  return rv;
}

if (require.main === module) {
  const vsn = getVersion(process.argv[2] || '.');
  process.stdout.write(JSON.stringify(vsn));
} else {
  module.exports = getVersion;
}
