'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}

test('Homey app version metadata stays consistent across manifest, package, lockfile, and changelog', () => {
  const packageJson = readJson('package.json');
  const packageLock = readJson('package-lock.json');
  const composeApp = readJson('.homeycompose/app.json');
  const generatedApp = readJson('app.json');
  const changelog = readJson('.homeychangelog.json');

  assert.equal(packageJson.version, composeApp.version);
  assert.equal(packageLock.version, composeApp.version);
  assert.equal(packageLock.packages[''].version, composeApp.version);
  assert.equal(generatedApp.version, composeApp.version);
  assert.ok(changelog[composeApp.version], `Missing Homey changelog entry for ${composeApp.version}`);
});
