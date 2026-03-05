import { readFileSync, writeFileSync } from 'fs';
import { marked } from 'marked';
import { execSync } from 'child_process';

const md = readFileSync('application-architecture.md', 'utf-8');

// Custom renderer for mermaid
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

renderer.code = function(code, language) {
  if (language === 'mermaid') {
    // Clean up mermaid code - remove leading/trailing whitespace
    const cleanCode = code.trim();
    const encoded = Buffer.from(cleanCode).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `<div class="mermaid-container"><img src="https://mermaid.ink/img/${encoded}?type=png&bgColor=white" /></div>`;
  }
  return originalCode(code, language);
};

marked.setOptions({ renderer });

const content = marked.parse(md);

const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Process GPT Application Architecture</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      padding: 20px;
    }
    h1 {
      text-align: center;
      font-size: 24pt;
      margin: 40px 0 30px;
      color: #1a1a1a;
    }
    h2 {
      font-size: 16pt;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 30px;
      color: #1e40af;
    }
    h3 {
      font-size: 13pt;
      margin-top: 20px;
      color: #374151;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 9pt;
    }
    pre {
      background-color: #1f2937;
      color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 9pt;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .mermaid-container {
      text-align: center;
      margin: 25px 0;
      background: white;
      padding: 10px;
    }
    .mermaid-container img {
      max-width: 100%;
      height: auto;
      max-height: 500px;
    }
    strong {
      color: #1f2937;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;

writeFileSync('application-architecture.html', fullHtml);
console.log('✅ HTML created: application-architecture.html');

// Convert to PDF using puppeteer
const puppeteerScript = `
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('file://' + resolve('application-architecture.html'), { waitUntil: 'networkidle0', timeout: 60000 });
await page.pdf({
  path: resolve('application-architecture.pdf'),
  format: 'A4',
  margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
  printBackground: true
});
await browser.close();
console.log('✅ PDF created: application-architecture.pdf');
`;

writeFileSync('_pdf.mjs', puppeteerScript);
try {
  execSync('node _pdf.mjs', { stdio: 'inherit' });
} finally {
  execSync('rm -f _pdf.mjs');
}
