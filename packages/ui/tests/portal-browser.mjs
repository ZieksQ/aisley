// Start Admin/Seller/Logistics Vite on 15175/15174/15176, then run from the repo root:
// node packages/ui/tests/portal-browser.mjs
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { openChatBrowser } from './chat-browser-driver.mjs'
import { installPortalFixtures } from './portal-fixtures.mjs'

const artifacts = resolve('node_modules/.cache/portal-browser')
mkdirSync(artifacts, { recursive: true })
const browser = await openChatBrowser()
const js = browser.evaluate
// First Vite dependency compilation can take longer than an ordinary UI wait.
browser.until = async (expression, label) => {
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    if (await js(expression)) return
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(`${label}; overflow=${JSON.stringify(await js("[...document.querySelectorAll('*')].map(el=>({tag:el.tagName,cls:el.getAttribute('class'),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(r=>r.width>0 && r.right>document.documentElement.clientWidth+1).slice(-20)"))}: ${await js('document.body.innerText.slice(0, 3000)')}; ${JSON.stringify(browser.errors)}`)
}
const click = async (selector) => {
  assert(await js(`!!document.querySelector(${JSON.stringify(selector)})`), `Missing ${selector}`)
  await js(`document.querySelector(${JSON.stringify(selector)}).click()`)
}
const key = async (key, code = key, modifiers = 0) => {
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers })
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers })
}
const pointerClick = async (selector) => {
  const point = await js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await browser.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
  await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
}
const assertChartMotionWiring = () => {
  const source = (file) => readFileSync(resolve(file), 'utf8')
  const charts = source('packages/ui/src/charts/DataChart.tsx') + source('packages/ui/src/charts/DistributionChart.tsx')
  assert.match(charts, /useReducedMotion\(\)/, 'Chart primitives read the motion preference')
  assert.match(charts, /animate && !reducedMotion/, 'Chart primitives disable animation for reduced motion')
  assert.match(charts, /animationDuration=\{700\}/, 'Chart animation has a bounded duration')
  for (const file of ['src/seller/src/components/dashboard/OrderActivityOverview.tsx', 'src/admin/src/components/dashboard/DashboardSummary.tsx', 'src/logistics/src/components/DashboardQueueOverview.tsx']) {
    assert.match(source(file), /<DataChart[^>]*animate/, `${file} opts into main chart animation`)
    assert.match(source(file), /<DistributionChart[^>]*animate/, `${file} opts into distribution chart animation`)
  }
  const dashboardStyles = source('packages/ui/src/portal/dashboard.css')
  for (const quadrant of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    assert(dashboardStyles.includes(`.dashboard-donut-tooltip--${quadrant}`), `Donut tooltip has an outward offset for ${quadrant}`)
  }
}
const assertKpiDesign = async (role, phase) => {
  const expectedCount = 4
  assert.equal(await js("document.querySelectorAll('.dashboard-stat-card').length"), expectedCount, `${role} ${phase}: expected KPI card count`)
  const audit = await js(`(() => [...document.querySelectorAll('.dashboard-stat-card')].map(card => {
    const header = card.querySelector('.dashboard-stat-header')
    const icon = card.querySelector('.dashboard-stat-icon, .dashboard-skeleton-icon')
    const label = card.querySelector('.dashboard-stat-label')
    const value = card.querySelector('.dashboard-stat-value, .skeleton-value')
    const detail = card.querySelector('.dashboard-stat-detail, .skeleton-detail')
    const box = card.getBoundingClientRect(), style = getComputedStyle(card)
    const panel = document.querySelector('.portal-panel') ? getComputedStyle(document.querySelector('.portal-panel')) : null
    return { border: style.borderWidth, borderStyle: style.borderStyle, borderColor: style.borderColor,
      background: style.backgroundColor, panelBorder: panel?.borderColor, panelBackground: panel?.backgroundColor,
      outline: style.outlineStyle, shadow: style.boxShadow,
      icon: !!icon, iconSvg: icon?.querySelector('svg') ? 1 : 0,
      structure: !!header && !!label && !!value && !!detail,
      labelWeight: label && getComputedStyle(label).fontWeight,
      valueWeight: value && getComputedStyle(value).fontWeight,
      bounds: [box.x, box.y, box.width] }
  })) )()`)
  assert(audit.every((card) => card.outline === 'none' && card.shadow === 'none'), `${role} ${phase}: no card focus treatment`)
  assert(audit.every((card) => card.structure), `${role} ${phase}: skeleton/content copy structure aligns`)
  if (phase === 'loaded') {
    assert(audit.every((card) => card.border === '1px' && card.borderStyle === 'solid' && card.borderColor === card.panelBorder && card.background === card.panelBackground), `${role}: separated cards match portal surface/border`)
    assert(audit.every((card) => card.icon && card.iconSvg === 1), `${role}: each KPI card has an icon`)
    assert(audit.every((card) => Number(card.labelWeight) >= 600 && Number(card.valueWeight) >= 600), `${role}: bold KPI title and value`)
    assert.equal(await js("document.querySelectorAll('.dashboard-stat-card a, .dashboard-stat-action, .dashboard-stat-change, .dashboard-mini-chart, .dashboard-mini-chart-svg').length"), 0, `${role}: no KPI links, change tags or mini charts`)
    assert.equal(await js("[...document.querySelectorAll('.dashboard-stat-card')].some(card => card.hasAttribute('tabindex'))"), false, `${role}: KPI cards are not focus targets`)
    assert.equal(await js("[...document.querySelectorAll('.dashboard-stat-card')].some(card => card.querySelector('.dashboard-stat-icon').getAttribute('aria-hidden') !== 'true')"), false, `${role}: decorative icons are hidden from assistive technology`)
    const expected = role === 'admin'
      ? [['Pending registrations', '16'], ['Open support tickets', '12'], ['Compliance cases', '4'], ['Oldest application', '0']]
      : role === 'seller'
        ? [['Awaiting approval', '7'], ['In preparation', '12'], ['Ready for pickup', '5'], ['Delivered', '168']]
        : [['Active shipments', '43'], ['Evidence pending', '5'], ['Completion intents', '3'], ['Out for delivery', '11']]
    const actual = await js("[...document.querySelectorAll('.dashboard-stat-card')].map(card => [card.querySelector('.dashboard-stat-label').textContent.trim(), card.querySelector('.dashboard-stat-value').textContent.trim()])")
    assert.deepEqual(actual, expected, `${role}: KPI copy preserves truthful role data`)
    if (role === 'seller') {
      assert.match(await js("document.querySelector('.dashboard-chart-comparison')?.textContent.trim()"), /48\.3%.*prior 7 days/i, 'Seller comparison remains in chart summary')
      assert.equal(await js("document.querySelectorAll('.dashboard-stat-card .dashboard-chart-comparison').length"), 0)
    }
  }
  return audit
}
const assertKpiSurface = async (role, theme) => {
  const surface = await js("(() => { const card=getComputedStyle(document.querySelector('.dashboard-stat-card')), panel=getComputedStyle(document.querySelector('.portal-panel')), page=getComputedStyle(document.querySelector('.portal-shell')); return {cardBackground:card.backgroundColor, panelBackground:panel.backgroundColor, pageBackground:page.backgroundColor, cardBorder:card.borderColor, panelBorder:panel.borderColor, cardBorderWidth:card.borderWidth, cardBorderStyle:card.borderStyle} })()")
  assert.equal(surface.cardBackground, surface.panelBackground, `${role} ${theme}: KPI surface matches portal panels`)
  assert.equal(surface.cardBorder, surface.panelBorder, `${role} ${theme}: KPI border matches portal panels`)
  assert.equal(surface.cardBorderWidth, '1px', `${role} ${theme}: visible KPI border`)
  assert.equal(surface.cardBorderStyle, 'solid')
  assert.notEqual(surface.cardBackground, surface.pageBackground, `${role} ${theme}: KPI surface is distinct from page background`)
}
const assertChartTooltipFollowsPointer = async (role) => {
  const points = await js(`(() => { const r=document.querySelector('.portal-chart .recharts-surface').getBoundingClientRect(); return [0.32,0.68].map(ratio=>({x:r.left+r.width*ratio,y:r.top+r.height*.45})) })()`)
  const samples = []
  for (const point of points) {
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
    await browser.until("!!document.querySelector('.dashboard-chart-tooltip')", `${role} chart tooltip visible`)
    samples.push(await js("(() => { const tip=document.querySelector('.dashboard-chart-tooltip'), wrapper=tip.parentElement, r=tip.getBoundingClientRect(); return {text:tip.textContent.trim(), left:r.left, top:r.top, pointerEvents:getComputedStyle(wrapper).pointerEvents, visibility:getComputedStyle(wrapper).visibility} })()"))
  }
  assert(samples.every((sample) => sample.text && sample.visibility === 'visible'), `${role}: hover exposes truthful chart tooltip values`)
  assert.equal(samples[0].pointerEvents, 'none', `${role}: tooltip does not intercept pointer movement`)
  assert(Math.abs(samples[0].left - samples[1].left) > 2 || Math.abs(samples[0].top - samples[1].top) > 2, `${role}: tooltip follows the pointer`)
}
const assertDonutTooltipAvoidsCenter = async (role) => {
  const points = await js(`(() => [...document.querySelectorAll('.dashboard-distribution .recharts-pie-sector')].map(path => {
    const length=path.getTotalLength(), point=path.getPointAtLength(length*.5), screen=new DOMPoint(point.x,point.y).matrixTransform(path.getScreenCTM())
    return {x:screen.x,y:screen.y}
  }))()`)
  assert(points.length > 0, `${role}: distribution chart has hoverable slices`)
  for (const point of points) {
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
    await browser.until("!!document.querySelector('.dashboard-distribution .dashboard-chart-tooltip')", `${role} donut tooltip visible`)
    const sample = await js("(() => { const tip=document.querySelector('.dashboard-distribution .dashboard-chart-tooltip'), offset=tip.closest('.dashboard-donut-tooltip'), a=tip.getBoundingClientRect(), b=document.querySelector('.dashboard-donut-total').getBoundingClientRect(); return {overlap:!(a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom), quadrant:[...offset.classList].find(name=>name.startsWith('dashboard-donut-tooltip--'))} })()")
    assert.equal(sample.overlap, false, `${role}: donut tooltip stays clear of the center total`)
    assert(sample.quadrant, `${role}: active donut tooltip selects an outward quadrant`)
  }
}
const serve = process.argv.includes('--serve')
assertChartMotionWiring()
const roles = [['admin', serve ? 16175 : 15175], ['seller', serve ? 16174 : 15174], ['logistics', serve ? 16176 : 15176]]
const roleFilter = process.argv.find((arg) => arg.startsWith('--role='))?.split('=')[1]
const services = []
const adminOrigin = `http://127.0.0.1:${roles[0][1]}`
try {
  if (serve) {
    for (const [role, port] of roles) {
      const service = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(process.argv.includes('--built') ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: resolve(`src/${role}`), stdio: ['ignore', 'pipe', 'pipe'] })
      services.push(service)
      service.stderr.on('data', (data) => process.stderr.write(`${role}: ${data}`))
      service.stdout.resume()
      const deadline = Date.now() + 60000
      let ready = false
      while (Date.now() < deadline) {
        if (service.exitCode !== null) throw new Error(`${role} dev server exited ${service.exitCode}`)
        if (await fetch(`http://127.0.0.1:${port}`).then((response) => response.ok).catch(() => false)) { ready = true; break }
        await new Promise((done) => setTimeout(done, 250))
      }
      assert(ready, `${role} dev server ready`)
    }
  }
  await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installPortalFixtures.toString()})();` })
  await browser.navigate(`${adminOrigin}/dashboard`)
  await browser.until('!!window.portalFixture', 'Fixture controls ready')
  await js("localStorage.removeItem('portal-restricted'); localStorage.removeItem('portal-consent-required')")
  for (const [role, port] of process.argv.includes('--final-checks') ? [] : roles.filter(([role]) => !roleFilter || role === roleFilter)) {
    await browser.cdp('Emulation.setEmulatedMedia', { features: [] })
    await js("document.documentElement.classList.remove('dark')")
    await browser.viewport(1440, 1000, false)
    await browser.navigate(`http://127.0.0.1:${port}/dashboard`)
    await browser.until("!!document.querySelector('.portal-shell .dashboard-skeleton')", `${role} skeleton within shell`)
    assert.equal(await js("/Checking (your session|policy consent)/.test(document.body.innerText)"), false)
    assert.equal(await js("document.querySelectorAll('.recharts-bar').length"), 0, 'No private dashboard before consent')
    const skeletonAudit = await assertKpiDesign(role, 'skeleton')
    const skeletonGrid = await js("({ columns: getComputedStyle(document.querySelector('.dashboard-metric-grid')).gridTemplateColumns, gap: getComputedStyle(document.querySelector('.dashboard-metric-grid')).gap })")
    await browser.screenshot(resolve(artifacts, `${role}-loading.png`))
    await browser.until("!!document.querySelector('.recharts-bar')", `${role} dashboard loaded`)
    const loadedAudit = await assertKpiDesign(role, 'loaded')
    await assertKpiSurface(role, 'light')
    await assertChartTooltipFollowsPointer(role)
    await assertDonutTooltipAvoidsCenter(role)
    const loadedGrid = await js("({ columns: getComputedStyle(document.querySelector('.dashboard-metric-grid')).gridTemplateColumns, gap: getComputedStyle(document.querySelector('.dashboard-metric-grid')).gap })")
    assert.equal(skeletonGrid.columns, loadedGrid.columns, `${role}: skeleton columns align with loaded cards`)
    assert.equal(skeletonGrid.gap, loadedGrid.gap, `${role}: skeleton spacing aligns with loaded cards`)
    assert.deepEqual(skeletonAudit.map(({ bounds }) => bounds), loadedAudit.map(({ bounds }) => bounds), `${role}: skeleton cards align with loaded cards`)
    assert.equal(await js("!!document.querySelector('.recharts-default-tooltip')"), false, 'Custom inactive tooltips occupy no space')
    await js("window.keptPortalShell = document.querySelector('.portal-shell'); true")
    const consentRequests = await js('window.portalFixture.consentRequests')
    await click('.portal-nav-link[href="/support-tickets"]')
    await browser.until("location.pathname === '/support-tickets'", `${role} ordinary navigation`)
    await click('.portal-nav-link[href="/dashboard"]')
    await browser.until("!!document.querySelector('.recharts-bar')", `${role} dashboard return`)
    assert.equal(await js('window.portalFixture.consentRequests'), consentRequests, 'Navigation reuses account consent')
    assert.equal(await js("document.querySelector('.portal-shell') === window.keptPortalShell"), true, 'Shell stays mounted')
    const point = await js("(() => {const r=document.querySelector('.recharts-surface').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
    assert.equal(await js("getComputedStyle(document.querySelector('.recharts-surface')).outlineStyle"), 'none', 'Pointer chart click has no outline')
    await key('Tab')
    await js("document.querySelector('.recharts-surface').focus()")
    assert.equal(await js("getComputedStyle(document.querySelector('.recharts-surface')).outlineStyle"), 'solid', 'Keyboard chart focus stays visible')
    await js('document.activeElement.blur()')
    await js(`localStorage.removeItem('aisley-${role}-sidebar')`)
    if (await js("document.querySelector('.portal-shell').classList.contains('is-collapsed')")) await click('.portal-desktop-toggle')
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-sidebar')).width"), '240px')
    await pointerClick('.portal-desktop-toggle')
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-desktop-toggle')).outlineStyle"), 'none', 'Pointer sidebar click has no outline')
    await pointerClick('.portal-desktop-toggle')
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 })

    assert.equal(await js("getComputedStyle(document.querySelector('.portal-toolbar')).height"), '64px')
    assert.equal(await js("document.querySelectorAll('.portal-nav button').length"), 0, 'No sidebar dropdowns')
    assert.equal(await js("document.querySelectorAll('.portal-nav-link[aria-current=page]').length"), 1)
    assert(await js("[...document.querySelectorAll('.portal-brand img')].every(img => img.complete && img.naturalWidth > 0)"), 'Brand assets loaded')
    assert(await js("document.fonts.check('500 14px Geist')"), 'Geist loaded')
    assert.equal(await js("document.documentElement.scrollWidth > innerWidth"), false)
    await browser.screenshot(resolve(artifacts, `${role}-desktop-light.png`))

    await js("document.documentElement.classList.add('dark')")
    await js("new Promise(done => setTimeout(done, 220))")
    await assertKpiSurface(role, 'dark')
    await browser.screenshot(resolve(artifacts, `${role}-desktop-dark.png`))
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-shell')).getPropertyValue('--portal-page').trim()"), '#0f172a')
    if (process.argv.includes('--design-only')) {
      for (const width of [768, 390, 320]) {
        await browser.viewport(width, 850, false)
        for (const dark of [false, true]) {
          await js(`document.documentElement.classList.toggle('dark', ${dark})`)
          await browser.until("document.documentElement.scrollWidth <= document.documentElement.clientWidth", `${role} no overflow at ${width}`)
          await browser.screenshot(resolve(artifacts, `${role}-${width}-${dark ? 'dark' : 'light'}.png`))
        }
        if (width === 320) await assertDonutTooltipAvoidsCenter(role)
      }
      assert.equal(await js("document.body.innerText.includes('View chart data')"), false)
      assert(await js("!!document.querySelector('.portal-chart .sr-only table')"), 'Screen-reader data')
      assert(await js("new Set([...document.querySelectorAll('.portal-chart path[fill]')].map(p=>p.getAttribute('fill')).filter(fill=>fill.includes('--chart-'))).size > 1"), 'Distinct graph colors')
      await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true, `${role}: reduced-motion preference is active`)
      assert(await js("!!document.querySelector('.portal-chart .recharts-surface')"), `${role}: main charts remain rendered with reduced motion`)
      if (role === 'seller') {
        const refreshActivity = async (variant) => {
          await js(`window.portalFixture.activityVariant = ${JSON.stringify(variant)}; window.portalFixture.activityVariantReturned = null`)
          await click('.dashboard-heading-actions button')
          await browser.until(`window.portalFixture.activityVariantReturned === ${JSON.stringify(variant)}`, `${variant} activity fixture returned`)
        }
        const assertComparison = async (text, tone) => {
          await browser.until(`document.querySelector('.dashboard-chart-comparison')?.textContent.includes(${JSON.stringify(text)})`, `${text} chart comparison rendered`)
          assert.equal(await js("[...document.querySelector('.dashboard-chart-comparison').classList].find(name => name.startsWith('dashboard-chart-comparison--'))"), `dashboard-chart-comparison--${tone}`)
          assert.equal(await js("document.querySelector('.dashboard-stat-card .dashboard-chart-comparison')"), null, 'Comparison stays outside KPI cards')
        }
        await assertComparison('+48.3%', 'positive')
        assert(await js("document.querySelector('.dashboard-chart-comparison').textContent.trim().startsWith('↗')"), 'Increasing comparison has an upward marker')
        await refreshActivity('decrease')
        await assertComparison('−50%', 'negative')
        assert(await js("document.querySelector('.dashboard-chart-comparison').textContent.trim().startsWith('↘')"), 'Decreasing comparison has a downward marker')
        await refreshActivity('new-activity')
        await assertComparison('New activity', 'positive')
        await refreshActivity('neutral')
        await assertComparison('No change', 'neutral')
        assert(await js("document.querySelector('.dashboard-chart-comparison').textContent.trim().startsWith('→')"), 'Neutral comparison has an unchanged marker')
        for (const variant of ['missing-prior', 'gap']) {
          await refreshActivity(variant)
          assert.equal(await js("!!document.querySelector('.dashboard-chart-comparison')"), false, `Seller omits comparison for ${variant} activity series`)
        }
        await refreshActivity('increase')
        await assertComparison('+48.3%', 'positive')
      }
      await js("window.portalFixture.empty = true")
      await click('.portal-content button')
      await browser.until("!document.querySelector('.recharts-bar') && !document.querySelector('.recharts-pie-sector')", `${role} zero state`)
      await js("window.portalFixture.failed = 'offline'")
      await click('.portal-content button')
      await browser.until("!!document.querySelector('.portal-content [role=alert]')", `${role} error state`)
      assert(await js("/stale|last loaded/i.test(document.querySelector('.portal-content').textContent)"))
      assert.deepEqual(await js('window.portalFixture.writes'), [])
      console.log(`${role}: redesigned cards, colors, pointer/keyboard focus, responsive themes, zero/error states passed`)
      continue
    }

    await click('.portal-desktop-toggle')
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-sidebar')).width"), '64px')
    assert.equal(await js("document.querySelector('.portal-desktop-toggle').getAttribute('aria-expanded')"), 'false')
    await js("document.querySelector('.portal-nav-link').focus()")
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-nav-tooltip')).display"), 'block', 'Rail tooltip on keyboard focus')
    assert(await js("document.querySelector('.portal-nav-link').textContent.includes('Dashboard')"), 'Rail keeps accessible labels')
    await browser.screenshot(resolve(artifacts, `${role}-rail-dark.png`))
    await browser.navigate(`http://127.0.0.1:${port}/dashboard`)
    await browser.until("!!document.querySelector('.portal-shell.is-collapsed')", `${role} rail persists`)

    for (const width of [768, 390, 320]) {
      await browser.viewport(width, 850, false)
      await js("document.documentElement.classList.remove('dark')")
      await browser.until("getComputedStyle(document.querySelector('.portal-sidebar')).display === 'none'", `${role} sidebar hidden on mobile`)
      await browser.until("document.documentElement.scrollWidth <= document.documentElement.clientWidth", `${role} no overflow at ${width}`)
      await click('.portal-mobile-toggle')
      await browser.until("document.querySelector('.portal-sidebar').getAttribute('role') === 'dialog'", 'Mobile dialog opens')
      assert.equal(await js("document.querySelector('.portal-workspace').inert"), true)
      assert.equal(await js("getComputedStyle(document.querySelector('.portal-nav-label')).position"), 'static', 'Labels visible in mobile drawer even with saved rail')
      await browser.until("document.activeElement.classList.contains('portal-mobile-close')", 'Focus enters visible drawer close button')
      await key('Tab', 'Tab', 8)
      assert.equal(await js("document.activeElement.closest('.portal-sidebar') !== null"), true, 'Focus stays in drawer')
      await key('Escape')
      await browser.until("!document.querySelector('.portal-sidebar.is-open')", 'Escape closes drawer')
      await browser.until("document.activeElement.classList.contains('portal-mobile-toggle')", 'Focus restored')
      assert.equal(await js("document.querySelector('.portal-workspace').inert"), false)
      await browser.screenshot(resolve(artifacts, `${role}-${width}-light.png`))
      await js("document.documentElement.classList.add('dark')")
      await js("new Promise(done => setTimeout(done, 220))")
      await browser.screenshot(resolve(artifacts, `${role}-${width}-dark.png`))
    }
    await click('.portal-mobile-toggle')
    await click('.portal-nav-link[to="/dashboard"], .portal-nav-link[href="/dashboard"]')
    await browser.until("!document.querySelector('.portal-sidebar.is-open')", 'Navigation closes drawer')
    await browser.viewport(1440, 1000, false)
    await click('.portal-desktop-toggle')
    await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true, `${role}: reduced-motion preference is active`)
    assert.equal(await js("getComputedStyle(document.querySelector('.portal-nav-link')).transitionDuration"), '0s')
    assert.equal(await js("document.body.innerText.includes('View chart data')"), false, 'No chart-data disclosure')
    assert(await js("!!document.querySelector('.portal-chart .sr-only table')"), 'Chart data remains available to screen readers')
    assert.equal(await js("getComputedStyle(document.querySelector('.dashboard-metric-grid')).columnGap"), '20px', 'Metric cards have individual spacing')
    assert(await js("new Set([...document.querySelectorAll('.portal-chart path[fill]')].map(p=>p.getAttribute('fill')).filter(fill=>fill.includes('--chart-'))).size > 1"), 'Distinct graph colors')
    await js("window.portalFixture.empty = true")
    await click('.portal-content button')
    await browser.until("!document.querySelector('.recharts-bar')", `${role} authoritative zero shown`)
    await js("window.portalFixture.failed = 'offline'")
    await click('.portal-content button')
    await browser.until("!!document.querySelector('.portal-content [role=alert]')", `${role} failed reads visible`)
    assert(await js("/stale|last loaded/i.test(document.querySelector('.portal-content').textContent)"), 'Failed refresh marked stale')
    assert.deepEqual(await js('window.portalFixture.writes'), [], 'Dashboard reads do not mutate')
    console.log(`${role}: desktop, rail, mobile, light/dark, focus, reduced motion, charts, empty/error passed`)
  }
  if (roleFilter) {
    assert.deepEqual(browser.errors, [])
    console.log(`${roleFilter} browser checks passed; screenshots: ${artifacts}`)
  } else {
  await browser.navigate(`${adminOrigin}/dashboard`)
  await browser.until("!!document.querySelector('.portal-shell')", 'Admin loaded')
  await js("localStorage.setItem('portal-restricted', 'true')")
  await browser.navigate(`${adminOrigin}/dashboard`)
  await browser.until("!!document.querySelector('.portal-shell')", 'Restricted admin loaded')
  await browser.until("document.body.innerText.includes('No dashboard queues are available')", 'Restricted dashboard settled')
  assert.equal(await js("document.querySelectorAll('.portal-nav-link').length"), 3, 'Only dashboard and personal links for restricted Admin')
  assert.equal(await js("document.querySelectorAll('.recharts-bar').length"), 0, 'No unauthorized chart')
  await js("localStorage.removeItem('portal-restricted')")
  await js("localStorage.setItem('portal-consent-required', 'true')")
  await browser.navigate(`${adminOrigin}/dashboard`)
  await browser.until("location.pathname === '/policy-consent'", 'Required consent redirect')
  assert.equal(await js("!!document.querySelector('.portal-shell')"), true, 'Required-consent screen retains shell')
  assert.equal(await js("document.querySelectorAll('.recharts-bar').length"), 0, 'Denied consent exposes no chart')
  await js("localStorage.removeItem('portal-consent-required')")
  const logisticsOrigin = `http://127.0.0.1:${roles[2][1]}`
  await browser.navigate(`${logisticsOrigin}/settings/appearance`)
  await browser.until("!!document.querySelector('#logistics-theme')", 'Logistics appearance settings')
  await js("localStorage.setItem('logistics-theme', 'system'); window.dispatchEvent(new StorageEvent('storage', { key: 'logistics-theme', newValue: 'system' }))")
  await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  await browser.until("document.documentElement.classList.contains('dark')", 'System dark theme')
  await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
  await browser.until("!document.documentElement.classList.contains('dark')", 'System light theme')
  assert.equal(await js("document.querySelector('#logistics-theme').value"), 'system')
  assert.equal(await js("document.querySelector('#logistics-account-menu')"), null)
  console.log('Logistics Settings: direct navigation and System theme preserved')
  assert.deepEqual(browser.errors, [])
  console.log(`Portal browser checks passed; screenshots: ${artifacts}`)
  }
} catch (error) {
  await browser.screenshot(resolve(artifacts, 'failure.png'))
  throw error
} finally {
  browser.close()
  for (const service of services) service.kill('SIGTERM')
}
