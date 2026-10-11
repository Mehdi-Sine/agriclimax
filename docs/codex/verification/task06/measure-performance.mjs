import path from 'node:path';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(path.resolve('tests/e2e/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto('http://127.0.0.1:3000/?production=wheat_soft&indicator=tmax_days_above&date=2026-07-01', { waitUntil: 'networkidle' });
  await page.locator('.maplibregl-canvas').waitFor();
  await page.locator('.maplibregl-canvas').focus();
  const measurement = await page.evaluate(async () => {
    const frames = [], canvas = document.querySelector('.maplibregl-canvas');
    let previous;
    await new Promise(resolve => {
      function frame(now) {
        if (previous !== undefined) frames.push(now - previous);
        previous = now;
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true }));
        if (frames.length < 120) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    const sorted = [...frames].sort((a,b) => a-b);
    const avg = frames.reduce((a,b) => a+b, 0)/frames.length;
    return { frames: frames.length, averageFrameMs: Math.round(avg*100)/100, averageFps: Math.round(100000/avg)/100, p95FrameMs: Math.round(sorted[Math.floor(sorted.length*.95)]*100)/100 };
  });
  await writeFile(new URL('./performance.json', import.meta.url), JSON.stringify({ targetFps: 60, environment: 'Chromium headless, SwiftShader software WebGL; not a hardware/GPU guarantee', viewport: [1440,900], riskCells: 1, basemapFeatures: 29, interaction: '120 requestAnimationFrame intervals with repeated keyboard pan', ...measurement }, null, 2));
} finally { await browser.close(); }
