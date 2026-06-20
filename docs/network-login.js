// Auto-login to KKU Network captive portal (https://login.kku.ac.th/)
// Run on VM startup before deploy.ps1, since internet/intranet access
// is blocked until this captive portal login succeeds.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'network-login.config.json');

function loadCredentials() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Missing ${CONFIG_PATH}. Copy network-login.config.example.json to network-login.config.json and fill in your KKU-Net username/password.`
    );
  }
  const { username, password } = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  if (!username || !password) {
    throw new Error('network-login.config.json is missing "username" or "password"');
  }
  return { username, password };
}

async function main() {
  const { username, password } = loadCredentials();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    await page.goto('https://login.kku.ac.th/', { waitUntil: 'load', timeout: 30000 });

    // If already authenticated, the portal redirects away from the login form.
    const onLoginPage = await page.locator('#loginForm').isVisible().catch(() => false);
    if (!onLoginPage) {
      console.log('[network-login] already authenticated, current URL:', page.url());
      return;
    }

    await page.click('#username');
    await page.type('#username', username, { delay: 50 });
    await page.click('#password');
    await page.type('#password', password, { delay: 50 });

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}),
      page.click('#loginForm button[type="submit"]'),
    ]);

    // give the portal's own JS time to submit the hidden encrypted form + redirect
    await page.waitForTimeout(2000);

    const errorText = await page.locator('#loginError').innerText().catch(() => '');
    const stillOnLoginForm = await page.locator('#loginForm').isVisible().catch(() => false);

    if (errorText.trim() || stillOnLoginForm) {
      throw new Error(`Login did not succeed. URL: ${page.url()} loginError: "${errorText.trim()}"`);
    }

    console.log('[network-login] success, current URL:', page.url());
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[network-login] failed:', err.message);
  process.exitCode = 1;
});
