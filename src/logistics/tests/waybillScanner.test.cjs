const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')
const { BarcodeFormat, BinaryBitmap, HybridBinarizer, QRCodeWriter, RGBLuminanceSource } = require('@zxing/library')

// Compile the actual shared reader to CommonJS for Node's test runner.
const filename = path.resolve(__dirname, '../src/lib/waybillScanner.ts')
const compiled = new Module(filename, module)
compiled.filename = filename
compiled.paths = Module._nodeModulePaths(path.dirname(filename))
compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, filename)
const { createWaybillReader } = compiled.exports

function bitmap(pixels, width, height) {
  return new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)))
}

// Use the same PHP Code 128 encoder as the printed waybill and lane labels.
function code128(reference, scale, top, barHeight) {
  const bars = JSON.parse(execFileSync('php', ['-r',
    'require "src/api/vendor/autoload.php"; $barcode = (new Picqer\\Barcode\\Types\\TypeCode128)->getBarcode($argv[1]); echo json_encode(array_map(fn($bar) => [$bar->getWidth(), $bar->isBar()], $barcode->getBars()));',
    reference,
  ], { encoding: 'utf8' }))
  const margin = 12 * scale
  const width = bars.reduce((sum, [size]) => sum + size * scale, margin * 2)
  const height = 480
  const pixels = new Uint8ClampedArray(width * height).fill(255)
  let x = margin
  for (const [size, black] of bars) {
    if (black) for (let y = top; y < top + barHeight; y++) pixels.fill(0, y * width + x, y * width + x + size * scale)
    x += size * scale
  }
  return bitmap(pixels, width, height)
}

test('reads thin tracking bars between default scan rows, at multiple module widths', () => {
  const reference = 'AWB-ABC123DEF456GH78'
  for (const scale of [1, 2, 3]) {
    const result = createWaybillReader().decodeBitmap(code128(reference, scale, 247, 4))
    assert.equal(result.getText(), reference)
    assert.equal(result.getBarcodeFormat(), BarcodeFormat.CODE_128)
  }
})

test('reads the Code 128 sorting lane label', () => {
  const reference = 'AISLEY:SORT-LANE:1:12345678-1234-4234-8234-123456789012'
  assert.equal(createWaybillReader().decodeBitmap(code128(reference, 2, 190, 60)).getText(), reference)
})

test('rejects the waybill QR even when it contains a valid tracking reference', () => {
  const qr = new QRCodeWriter().encode('AISLEY:WB:1:AWB-ABC123DEF456GH78', BarcodeFormat.QR_CODE, 240, 240, new Map())
  const pixels = new Uint8ClampedArray(240 * 240).fill(255)
  for (let y = 0; y < 240; y++) for (let x = 0; x < 240; x++) if (qr.get(x, y)) pixels[y * 240 + x] = 0
  assert.throws(() => createWaybillReader().decodeBitmap(bitmap(pixels, 240, 240)))
})
