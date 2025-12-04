import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM, ResourceLoader } from 'jsdom';

const legacyRoot = resolve(__dirname, '../baselines/legacy-v0');
const legacyHtmlPath = resolve(legacyRoot, 'index.html');
const legacyHtml = readFileSync(legacyHtmlPath, 'utf-8');

class LegacyResourceLoader extends ResourceLoader {
  override fetch(url: string): Promise<Buffer | null> {
    const parsed = new URL(url);
    if (parsed.hostname !== 'legacy.test') {
      return Promise.resolve(Buffer.from(''));
    }
    const relativePath = parsed.pathname.replace(/^\/+/, '');
    const fsPath = resolve(legacyRoot, relativePath);
    return readFile(fsPath).catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      const err = new Error(`无法加载 legacy 资源 ${relativePath}: ${reason}`);
      err.name = 'LegacyResourceMissingError';
      throw err;
    });
  }
}

function createStaticDom() {
  return new JSDOM(legacyHtml);
}

async function createInteractiveDom() {
  const dom = new JSDOM(legacyHtml, {
    url: 'https://legacy.test/',
    runScripts: 'dangerously',
    resources: new LegacyResourceLoader(),
    pretendToBeVisual: true,
  });
  await waitForLoad(dom);
  return dom;
}

function waitForLoad(dom: JSDOM): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      dom.window.removeEventListener('load', handleLoad);
      dom.window.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      dom.window.setTimeout(() => resolve(), 0);
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Legacy DOM failed to load required scripts'));
    };

    dom.window.addEventListener('load', handleLoad);
    dom.window.addEventListener('error', handleError);
  });
}

function waitForMacrotask(dom: JSDOM): Promise<void> {
  return new Promise((resolve) => {
    dom.window.setTimeout(() => resolve(), 0);
  });
}

describe('legacy baseline', () => {
  it('contains the expected screen containers', () => {
    const { document } = createStaticDom().window;
    const home = document.getElementById('home-screen');
    const selection = document.getElementById('game-selection-screen');
    const setup = document.getElementById('setup-screen');

    expect(home).toBeTruthy();
    expect(selection).toBeTruthy();
    expect(setup).toBeTruthy();
    expect(
      document.querySelectorAll('#player-setup-container .player-input').length
    ).toBeGreaterThanOrEqual(8);
  });

  it('keeps script tags in the original order', () => {
    const { document } = createStaticDom().window;
    const scripts = Array.from(document.querySelectorAll('body script[src]'));
    const legacyScripts = scripts
      .map((script) => script.getAttribute('src'))
      .filter((src): src is string => Boolean(src) && src.endsWith('.js'));

    const expected = [
      'src/jquery-3.4.1.js',
      'js/index.js',
      'js/fasttrack.js',
      'js/cards.js',
      'js/options.js',
      'js/display.js',
      'js/board.js',
    ];

    expect(legacyScripts.slice(-expected.length)).toEqual(expected);
  });

  it('navigates through the entry flow for a new game', async () => {
    const dom = await createInteractiveDom();
    try {
      const { document } = dom.window;
      const home = document.getElementById('home-screen');
      const selection = document.getElementById('game-selection-screen');
      const setup = document.getElementById('setup-screen');
      const newRoomBtn = document.getElementById('new-room-button');

      if (!home || !selection || !setup || !newRoomBtn) {
        throw new Error('Legacy DOM missing expected containers');
      }

      home.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      await waitForMacrotask(dom);

      expect(home.style.display).toBe('none');
      expect(selection.style.display).toBe('block');

      newRoomBtn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      await waitForMacrotask(dom);

      expect(selection.style.display).toBe('none');
      expect(setup.style.display).toBe('block');
    } finally {
      dom.window.close();
    }
  });
});
