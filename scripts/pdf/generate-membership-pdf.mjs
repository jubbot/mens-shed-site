import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = process.env.PDF_URL || 'http://localhost:4321/membership';
const OUT = process.env.PDF_OUT || 'public/pdf/membership-form.pdf';

(async () => {
  await fs.mkdir(path.dirname(OUT), { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    // ↓↓↓ add these flags on Ubuntu/most Linux to avoid the sandbox error
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');

  try {
    await page.waitForSelector('#membership-form', { timeout: 10000 });
  } catch {}

  await page.pdf({
    path: OUT,
    printBackground: true,
    preferCSSPageSize: true,
    format: 'A4',
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
  });

  await browser.close();
  console.log(`✓ PDF written to ${OUT}`);
})();
