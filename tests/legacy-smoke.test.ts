import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

const legacyHtml = readFileSync(resolve(__dirname, '../baselines/legacy-v0/index.html'), 'utf-8');

function createDom() {
  return new JSDOM(legacyHtml);
}

describe('legacy baseline', () => {
  it('contains the expected screen containers', () => {
    const { document } = createDom().window;
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
    const { document } = createDom().window;
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
});
