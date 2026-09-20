const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

const repository = path.resolve(__dirname, '../../..')
const filename = path.resolve(__dirname, '../src/lib/waybillScanner.ts')
const compiled = new Module(filename, module)
compiled.filename = filename
compiled.paths = Module._nodeModulePaths(path.dirname(filename))
compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, filename)
const { createWaybillReader, decodeWaybillCanvas } = compiled.exports
const hasPdfRasterizer = !spawnSync('pdftoppm', ['-v']).error

function renderedWaybill(reference) {
  const php = String.raw`
    require 'src/api/vendor/autoload.php';
    $app = require 'src/api/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $reference = $argv[1];
    $barcode = (new Picqer\Barcode\BarcodeGeneratorSVG)->getBarcode($reference, Picqer\Barcode\BarcodeGeneratorSVG::TYPE_CODE_128, 1.0, 42);
    $qr = (new BaconQrCode\Writer(new BaconQrCode\Renderer\ImageRenderer(new BaconQrCode\Renderer\RendererStyle\RendererStyle(320, 4), new BaconQrCode\Renderer\Image\SvgImageBackEnd)))->writeString('AISLEY:WB:1:'.$reference);
    $address = ['name' => 'Test Recipient', 'contact_number' => '09123456789', 'address_line_1' => '123 Test Street', 'address_line_2' => null, 'barangay' => 'Test Barangay', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'postal_code' => '1000', 'region' => 'NCR', 'country' => 'Philippines'];
    $snapshot = ['tracking_id' => $reference, 'waybill_reference' => $reference, 'order_reference' => 'ORD-TEST', 'created_at' => '2026-09-21', 'recipient' => $address, 'pickup' => $address, 'shop' => ['name' => 'Test Shop'], 'logistics' => ['business_name' => 'Test Logistics', 'hub_name' => 'Test Hub', 'hub_area' => $address], 'payment' => ['currency' => 'PHP', 'collectible_amount' => '100.00'], 'item_quantity' => 1];
    $labels = collect([['snapshot' => $snapshot, 'barcode' => 'data:image/svg+xml;base64,'.base64_encode($barcode), 'qr' => 'data:image/svg+xml;base64,'.base64_encode($qr)]]);
    echo Barryvdh\DomPDF\Facade\Pdf::setOptions(['isRemoteEnabled' => false, 'isPhpEnabled' => false, 'isJavascriptEnabled' => false, 'defaultFont' => 'Helvetica', 'chroot' => resource_path('views/waybills')])->loadView('waybills.a6', ['labels' => $labels])->setPaper([0, 0, 297.64, 419.53])->output();
  `
  return execFileSync('php', ['-r', php, reference], { cwd: repository, maxBuffer: 5 * 1024 * 1024 })
}

function rasterizedPage(pdf, dpi) {
  const pgm = execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-gray', '-r', String(dpi), '-'], {
    input: pdf, cwd: repository, maxBuffer: 5 * 1024 * 1024,
  })
  const header = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(pgm.subarray(0, 100).toString('ascii'))
  assert.ok(header, 'pdftoppm returned an 8-bit grayscale page')
  const width = Number(header[1])
  const height = Number(header[2])
  const gray = pgm.subarray(header[0].length)
  assert.equal(gray.length, width * height)
  const rgba = new Uint8ClampedArray(gray.length * 4)
  for (let i = 0; i < gray.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = gray[i]
    rgba[i * 4 + 3] = 255
  }
  return { width, height, getContext: () => ({ getImageData: () => ({ data: rgba }) }) }
}

test('the complete rendered A6 waybill decodes when its bars occupy enough camera pixels', {
  skip: !hasPdfRasterizer && 'pdftoppm is unavailable',
}, () => {
  const reference = 'AWB-ABC123DEF456GH78'
  const pdf = renderedWaybill(reference)
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')))
  for (const dpi of [144, 192]) {
    const page = rasterizedPage(pdf, dpi)
    assert.equal(decodeWaybillCanvas(createWaybillReader(), page).getText(), reference, `at ${dpi} DPI`)
  }
})
