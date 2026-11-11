// CI contract: the official image supplies browser binaries and system libraries.
// Fail on package/image drift or a broken browser; never download or skip checks.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
const require = createRequire(new URL('../../tests/e2e/package.json', import.meta.url));
const {version} = require('playwright/package.json');
const {chromium} = require('playwright');
const image = JSON.parse(await readFile('/ms-playwright/.docker-info', 'utf8'));
assert.equal(image.driverVersion, version, 'Update the official image tag/digest and Playwright lockfile together');
assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, '/ms-playwright', 'Use the preinstalled browser directory');
const executable = chromium.executablePath();
assert.ok(executable.startsWith('/ms-playwright/'), 'Chromium must come from the official image');
const browser = await chromium.launch({args: ['--no-sandbox', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage();
  await page.setContent('<title>Playwright runtime verified</title>');
  assert.equal(await page.title(), 'Playwright runtime verified');
  const receipt = {playwright: version, image, chromium: browser.version(), executable, launch: 'passed'};
  await mkdir('work/quality/e2e', {recursive: true});
  await writeFile('work/quality/e2e/browser-runtime.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  await browser.close();
}
