#!/usr/bin/env node

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

// This code will generate changelog entries

const { readFile } = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('isomorphic-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const jsdom = require('jsdom');
const { promisify } = require('util');

const readFilePromise = promisify(readFile);

const DOMAIN = 'https://github.com/';

const URL_PARTS = [`${DOMAIN}jaegertracing/jaeger-ui/pulls?page=`, '&q=is%3Apr+is%3Amerged&utf8=%E2%9C%93'];

function getData(elm) {
  const title = elm.querySelector('[data-hovercard-type="pull_request"]').textContent;
  const url = elm.querySelector('[data-hovercard-type="pull_request"]').href;
  const pid = /#\d+/g.exec(elm.querySelector('.opened-by').textContent)[0];
  const user = elm.querySelector('a.muted-link').textContent;
  const dateMerged = new Date(elm.querySelector('[datetime]').getAttribute('datetime'));
  return { title, url, pid, user, dateMerged };
}

function fmtPr(data) {
  const { title, url, pid, user } = data;
  return `- ${title} ([@${user}](https://github.com/${user}) in [${pid}](${url}))`;
}

function compareMergedDates(a, b) {
  return a.dateMerged > b.dateMerged ? 1 : Number(a.dateMerged === b.dateMerged) - 1;
}

function getPrData(document) {
  const wrapper = document.querySelector('[aria-label="Issues"][role="group"]');
  const issues = [].slice.call(wrapper.querySelectorAll('.js-issue-row'));
  const okIssues = issues.filter(elm => !elm.querySelector('[aria-label*="Closed"]'));
  return okIssues.map(getData);
}

function getMergedPrs(page) {
  const _page = page == null || Number.isNaN(page) ? 1 : Number(page);
  const url = URL_PARTS.join(_page);
  return (
    fetch(url)
      .then(resp => resp.text())
      .then(textContent => {
        const dom = new jsdom.JSDOM(textContent, { url: DOMAIN });
        return getPrData(dom.window.document);
      })
      // eslint-disable-next-line no-console
      .catch(error => console.error(error))
  );
}

function getChangelog(pages) {
  const _pages = pages == null || Number.isNaN(pages) ? 1 : Number(pages);
  const promises = [];
  for (let i = 1; i <= _pages; i++) {
    promises.push(getMergedPrs(i));
  }
  return (
    Promise.all(promises)
      .then(groups => [].concat(...groups))
      .then(items => {
        items.sort(compareMergedDates);
        items.reverse();
        return items;
      })
      // eslint-disable-next-line no-console
      .catch(error => console.error(error))
  );
}

if (require.main === module) {
  Promise.all([getChangelog(process.argv[2] || 1), readFilePromise('./CHANGELOG.md', 'utf8')])
    .then(([items, changelog]) =>
      // eslint-disable-next-line no-console
      console.log(
        items
          .filter(({ pid, url }) => changelog.indexOf(`[${pid}](${url})`) === -1)
          .map(fmtPr)
          .join('\n\n')
      )
    )
    // eslint-disable-next-line no-console
    .catch(error => console.error(error));
} else {
  module.exports = getChangelog;
}
