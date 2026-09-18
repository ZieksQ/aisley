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

const { cameraErrorMessage, startWaybillCamera } = compiled.exports
const { BrowserMultiFormatOneDReader } = require('@zxing/browser')

function cameraFixture(t, getUserMedia) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true } })
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete globalThis.navigator
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  })
  let stopped = 0
  const stream = { getTracks: () => [{ stop: () => stopped++ }] }
  const video = { srcObject: null, play: async () => {}, pause: () => {} }
  return { stream, video, stopped: () => stopped }
}

test('explains HTTPS requirement even with camera permission enabled', async (t) => {
  let requested = false
  const { video } = cameraFixture(t, async () => { requested = true })
  window.isSecureContext = false
  await assert.rejects(startWaybillCamera(video, () => {}, new AbortController().signal), (error) => {
    assert.match(cameraErrorMessage(error), /HTTPS/)
    return error.name === 'InsecureContextError'
  })
  assert.equal(requested, false)
})

test('Stop while permission is pending releases the late stream without playing', async (t) => {
  let resolveRequest
  const fixture = cameraFixture(t, () => new Promise((resolve) => { resolveRequest = resolve }))
  let played = false
  fixture.video.play = async () => { played = true }
  const abort = new AbortController()
  const starting = startWaybillCamera(fixture.video, () => {}, abort.signal)
  abort.abort()
  resolveRequest(fixture.stream)
  await assert.rejects(starting, { name: 'AbortError' })
  assert.equal(fixture.stopped(), 1)
  assert.equal(played, false)
  assert.equal(fixture.video.srcObject, null)
})

test('Stop releases the camera while video playback is still pending', async (t) => {
  const fixture = cameraFixture(t, async () => fixture.stream)
  fixture.video.play = () => new Promise(() => {})
  const abort = new AbortController()
  const starting = startWaybillCamera(fixture.video, () => {}, abort.signal)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(fixture.video.srcObject, fixture.stream)
  abort.abort()
  await assert.rejects(starting, { name: 'AbortError' })
  assert.ok(fixture.stopped() >= 1)
  assert.equal(fixture.video.srcObject, null)
})

test('playback failure releases camera and gives a specific retry message', async (t) => {
  const fixture = cameraFixture(t, async () => fixture.stream)
  fixture.video.play = async () => { throw new Error('autoplay failed') }
  await assert.rejects(startWaybillCamera(fixture.video, () => {}, new AbortController().signal), (error) => {
    assert.match(cameraErrorMessage(error), /preview could not play/)
    return error.name === 'CameraPlaybackError'
  })
  assert.equal(fixture.stopped(), 1)
  assert.equal(fixture.video.srcObject, null)
})

test('falls back on unsupported constraints and delivers actual waybill tracking ID', async (t) => {
  const requests = []
  const fixture = cameraFixture(t, async (constraints) => {
    requests.push(constraints)
    if (requests.length === 1) throw new DOMException('unsupported', 'OverconstrainedError')
    return fixture.stream
  })
  const originalScan = BrowserMultiFormatOneDReader.prototype.scan
  let stoppedScan = false
  BrowserMultiFormatOneDReader.prototype.scan = function (video, callback, finalize) {
    assert.equal(video.srcObject, fixture.stream)
    callback(this.decodeBitmap(code128('AWB-ABC123DEF456GH78', 2, 200, 34)))
    return { stop: () => { stoppedScan = true; finalize() } }
  }
  t.after(() => { BrowserMultiFormatOneDReader.prototype.scan = originalScan })
  const decoded = []
  const controls = await startWaybillCamera(fixture.video, (raw) => decoded.push(raw), new AbortController().signal)
  assert.deepEqual(requests[1], { audio: false, video: true })
  assert.deepEqual(decoded, ['AWB-ABC123DEF456GH78'])
  assert.equal(fixture.video.autoplay, true)
  assert.equal(fixture.video.playsInline, true)
  controls.stop()
  assert.equal(stoppedScan, true)
  assert.equal(fixture.video.srcObject, null)
})

test('permission denial is not retried with different camera constraints', async (t) => {
  let requests = 0
  const { video } = cameraFixture(t, async () => {
    requests++
    throw new DOMException('blocked', 'NotAllowedError')
  })
  await assert.rejects(startWaybillCamera(video, () => {}, new AbortController().signal), { name: 'NotAllowedError' })
  assert.equal(requests, 1)
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /Close other apps/)
})
