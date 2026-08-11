/*
 * PDF 텍스트 레이어 감지 테스트 〔M-1 · precheck.html〕
 *
 *   npm test        (node --test test/)
 *
 * ── 🔴 감지 코드를 어디서 가져오는가 ──────────────────────────────────────────
 * 감지 블록은 **precheck.html 안에** 있습니다. 이 저장소의 페이지는 한 파일로
 * 완결되고, 빌드(scripts/build-static.js)가 HTML 안의 주석만 떼어 내보내기
 * 때문입니다 — 별도 .js 로 빼면 인수인계용 주석이 그대로 배포됩니다.
 *
 * 그래서 이 테스트는 **소스에서 그 블록을 잘라내 실행**합니다. 사본을 두지
 * 않습니다 — 사본을 두면 화면이 쓰는 코드와 초록불이 갈립니다.
 * 잘라내는 구간은 아래 OPEN·CLOSE 두 상수가 가리키는 표지 사이이고,
 * 표지가 사라지면 이 테스트가 먼저 red 를 냅니다.
 *
 * ── 무엇을 재는가 ───────────────────────────────────────────────────────────
 *   ① 실제 파일 2종 — macOS 도구로 만든 진짜 텍스트 PDF · 진짜 랩스터 PDF
 *   ② OCR 표본 — 이미지 + 비가시 텍스트. **여기서 안내가 뜨면 오탐입니다**
 *   ③ 압축 객체스트림 — /Font 가 원시 바이트에 안 보이는 현대 PDF
 *   ④ 못 정하는 경우 — 암호화 · PDF 아님 · 빈 파일 → 'unknown'(안내 없음)
 *   ⑤ 처리되지 않은 거절 0건 — 압축 해제 실패가 콘솔 오류로 새지 않는가
 *
 * 표본은 커밋하지 않고 이 파일이 만듭니다(zlib 로 조립). 바이너리를 저장소에
 * 넣지 않아도 같은 조건이 재현됩니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

/* ── 감지 블록을 소스에서 잘라내 실행 ──────────────────────────────────────── */

const PAGE = path.join(__dirname, '..', 'precheck.html');
const OPEN = '/* <text-layer-detect>';
const CLOSE = '/* </text-layer-detect> */';

function loadDetector() {
  const src = fs.readFileSync(PAGE, 'utf8');
  const from = src.indexOf(OPEN);
  const to = src.indexOf(CLOSE);
  assert.ok(from !== -1 && to > from,
    'precheck.html 에서 text-layer-detect 표지를 찾지 못했습니다 — 감지 블록이 사라졌거나 표지가 바뀌었습니다');

  const block = src.slice(from, to + CLOSE.length);
  // 블록은 브라우저 전역만 씁니다(TextDecoder · Blob · DecompressionStream).
  // Node 20 에 셋 다 있으므로 그대로 실행됩니다.
  const factory = new Function(
    block + '\nreturn { detectTextLayerInBytes: detectTextLayerInBytes, TEXT_LAYER: TEXT_LAYER, isPdfFile: isPdfFile, detectFileTextLayer: detectFileTextLayer };'
  );
  return factory();
}

const detector = loadDetector();
const detect = detector.detectTextLayerInBytes;

/* ── 표본 ──────────────────────────────────────────────────────────────────── */

const FIXTURES = path.join(__dirname, '..', '.tmp-text-layer-fixtures');

/** 최소 PDF 조립기 — 고전 xref. */
function buildPdf(objects, version) {
  const parts = [Buffer.from('%PDF-' + (version || '1.4') + '\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = parts[0].length;
  const offsets = [];

  objects.forEach((body, i) => {
    const chunk = Buffer.concat([
      Buffer.from((i + 1) + ' 0 obj\n', 'latin1'),
      Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'),
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    offsets.push(offset);
    offset += chunk.length;
    parts.push(chunk);
  });

  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  offsets.forEach((o) => { xref += String(o).padStart(10, '0') + ' 00000 n \n'; });
  xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' +
    offset + '\n%%EOF\n';

  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

function streamObj(dict, data) {
  return Buffer.concat([
    Buffer.from('<< ' + dict + ' /Length ' + data.length + ' >>\nstream\n', 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

/** 이미지 자리에 넣을 JPEG 흉내 바이트 — 압축을 풀 대상이 아니라는 것만 중요합니다. */
function fakeJpeg(bytes) {
  const body = Buffer.alloc(bytes || 20000, 0x5a);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), body, Buffer.from([0xff, 0xd9])]);
}

/**
 * 실제 파일 2종. macOS 기본 도구로 만듭니다 —
 *   real-text  cupsfilter  글자를 그리는 진짜 PDF
 *   real-scan  sips        그 PDF 를 랩스터화한 것 = 텍스트 레이어 없는 스캔
 * 도구가 없는 환경(CI)에서는 건너뛰되 **건너뛴 사실이 보고에 남습니다.**
 */
function buildRealSamples() {
  const { execFileSync } = require('node:child_process');
  const txt = path.join(FIXTURES, 'nda.txt');
  const textPdf = path.join(FIXTURES, 'real-text.pdf');
  const png = path.join(FIXTURES, 'page.png');
  const scanPdf = path.join(FIXTURES, 'real-scan.pdf');

  fs.writeFileSync(txt,
    'MUTUAL NON-DISCLOSURE AGREEMENT\n\n' +
    'This Agreement is entered into as of the date last signed below.\n\n' +
    '1. Confidential Information means any information disclosed by either party.\n');

  try {
    fs.writeFileSync(textPdf, execFileSync('cupsfilter', [txt], {
      maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    }));
    execFileSync('sips', ['-s', 'format', 'png', textPdf, '--out', png], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'pdf', png, '--out', scanPdf], { stdio: 'ignore' });
    return { text: textPdf, scan: scanPdf };
  } catch (err) {
    return null;
  }
}

let real = null;

test.before(() => {
  fs.mkdirSync(FIXTURES, { recursive: true });
  real = buildRealSamples();
});

test.after(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true });
});

/* ── ① 실제 파일 ──────────────────────────────────────────────────────────── */

test('실제 텍스트 PDF — present (cupsfilter 산출물)', async (t) => {
  if (!real) return t.skip('macOS cupsfilter/sips 없음 — 실제 파일 대조를 건너뜁니다');
  assert.strictEqual(await detect(new Uint8Array(fs.readFileSync(real.text))), 'present');
});

test('실제 랩스터 PDF — absent (sips 로 이미지화한 같은 문서)', async (t) => {
  if (!real) return t.skip('macOS cupsfilter/sips 없음 — 실제 파일 대조를 건너뜁니다');
  assert.strictEqual(await detect(new Uint8Array(fs.readFileSync(real.scan))), 'absent',
    '글자가 없는 스캔인데 감지하지 못했습니다 — 안내가 뜨지 않습니다');
});

/* ── ② OCR 표본 — 오탐이 나면 안 되는 자리 ────────────────────────────────── */

test('OCR 된 스캔은 present — 판별 기준은 「스캔인가」가 아니라 「글자층이 있는가」다', async () => {
  const content = zlib.deflateSync(Buffer.from(
    'q 612 0 0 792 0 0 cm /Im0 Do Q\n' +
    'BT 3 Tr /F1 12 Tf 72 700 Td (MUTUAL NON-DISCLOSURE AGREEMENT) Tj ET\n', 'latin1'));

  const pdf = buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >> >> /Contents 4 0 R >>',
    streamObj('/Filter /FlateDecode', content),
    streamObj('/Type /XObject /Subtype /Image /Width 1224 /Height 1584 ' +
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', fakeJpeg()),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);

  assert.strictEqual(await detect(new Uint8Array(pdf)), 'present',
    'OCR 된 스캔에 안내가 뜹니다 — 오탐입니다');
});

test('이미지만 있는 PDF 는 absent — 글꼴도 텍스트 연산자도 없다', async () => {
  const content = zlib.deflateSync(Buffer.from('q 612 0 0 792 0 0 cm /Im0 Do Q\n', 'latin1'));
  const pdf = buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
    streamObj('/Filter /FlateDecode', content),
    streamObj('/Type /XObject /Subtype /Image /Width 1224 /Height 1584 ' +
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', fakeJpeg()),
  ]);

  assert.strictEqual(await detect(new Uint8Array(pdf)), 'absent');
});

/* ── ③ 압축 객체스트림 — 원시 grep 으로는 못 찾는 경우 ────────────────────── */

test('글꼴이 압축 객체스트림에만 있어도 present — 원시 바이트만 보면 오탐이 난다', async () => {
  const inner = '1 0 2 36 5 88 ' +
    '<< /Type /Catalog /Pages 2 0 R >>\n' +
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n';
  const objstm = zlib.deflateSync(Buffer.from(inner, 'latin1'));
  const content = zlib.deflateSync(Buffer.from('q 1 0 0 1 0 0 cm Q\n', 'latin1'));

  const pdf = buildPdf([
    streamObj('/Filter /FlateDecode', content),
    streamObj('/Type /ObjStm /N 3 /First 14 /Filter /FlateDecode', objstm),
  ], '1.5');

  const raw = pdf.toString('latin1');
  assert.strictEqual(raw.indexOf('/Font'), -1,
    '표본이 뜻을 잃었습니다 — /Font 가 원시 바이트에 보이면 압축 해제 경로를 재지 못합니다');
  assert.strictEqual(await detect(new Uint8Array(pdf)), 'present');
});

/* ── ④ 못 정하는 경우는 안내하지 않는다 ───────────────────────────────────── */

test('암호화된 PDF 는 unknown — 스트림을 풀 수 없으면 없다고 말하지 않는다', async () => {
  const pdf = buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [] /Count 0 >>',
    '<< /Filter /Standard /V 2 /R 3 /O <00> /U <00> /P -1 >>',
  ]);
  const withEncrypt = Buffer.from(
    pdf.toString('latin1').replace('/Root 1 0 R', '/Root 1 0 R /Encrypt 3 0 R'), 'latin1');

  assert.strictEqual(await detect(new Uint8Array(withEncrypt)), 'unknown');
});

test('PDF 가 아니면 unknown — 빈 파일도 unknown', async () => {
  assert.strictEqual(await detect(new Uint8Array(Buffer.from('그냥 텍스트입니다', 'utf8'))), 'unknown');
  assert.strictEqual(await detect(new Uint8Array(fakeJpeg(100))), 'unknown');
  assert.strictEqual(await detect(new Uint8Array(0)), 'unknown');
});

test('압축 스트림을 하나도 풀지 못하면 unknown — absent 라고 단정하지 않는다', async () => {
  // /FlateDecode 라고 적혀 있지만 내용이 zlib 이 아닌 스트림.
  const junk = Buffer.alloc(400, 0x41);
  const pdf = buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    streamObj('/Filter /FlateDecode', Buffer.concat([Buffer.from([0x78, 0x9c]), junk])),
  ]);
  assert.strictEqual(await detect(new Uint8Array(pdf)), 'unknown');
});

/* ── 파일 단위 진입점 ─────────────────────────────────────────────────────── */

test('PDF 가 아닌 파일은 판별 대상이 아니다 — null (unknown 과 구분한다)', async () => {
  assert.strictEqual(detector.isPdfFile({ name: 'nda.pdf', type: '' }), true);
  assert.strictEqual(detector.isPdfFile({ name: 'nda.docx', type: '' }), false);
  assert.strictEqual(detector.isPdfFile({ name: 'x', type: 'application/pdf' }), true);

  const docx = new Blob([Buffer.from('PK')]);
  docx.name = 'nda.docx';
  assert.strictEqual(await detector.detectFileTextLayer(docx), null);
});

test('File 객체에서도 같은 답이 나온다 — 화면이 부르는 경로', async () => {
  const content = zlib.deflateSync(Buffer.from('q 612 0 0 792 0 0 cm /Im0 Do Q\n', 'latin1'));
  const pdf = buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>',
    streamObj('/Filter /FlateDecode', content),
  ]);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  blob.name = 'scan.pdf';
  assert.strictEqual(await detector.detectFileTextLayer(blob), 'absent');
});

/* ── ⑤ 처리되지 않은 거절이 새지 않는가 ───────────────────────────────────── */

/*
 * 압축 해제 실패는 흔합니다(스트림 경계를 잘못 잡았거나 필터가 섞인 경우).
 * 그때 처리되지 않은 거절이 남으면 **이용자 콘솔에 오류로 찍힙니다** —
 * 결제 화면에서 붉은 오류가 보이는 것은 그 자체로 신뢰를 깎습니다.
 */
test('압축 해제가 실패해도 처리되지 않은 거절이 남지 않는다', async () => {
  const leaked = [];
  const onLeak = (err) => leaked.push(err && err.message ? err.message : String(err));
  process.on('unhandledRejection', onLeak);

  try {
    const junk = Buffer.concat([Buffer.from([0x78, 0x9c]), Buffer.alloc(300, 0x41)]);
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>',
      streamObj('/Filter /FlateDecode', junk),
    ]);
    await detect(new Uint8Array(pdf));
    // 거절은 다음 마이크로태스크 뒤에 보고됩니다 — 조금 기다립니다.
    await new Promise((r) => setTimeout(r, 200));
  } finally {
    process.removeListener('unhandledRejection', onLeak);
  }

  assert.deepStrictEqual(leaked, [],
    '처리되지 않은 거절이 남았습니다 — 이용자 콘솔에 오류로 찍힙니다');
});
