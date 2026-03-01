import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('authorize section has an icon close button and visibility state toggle', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /faXmark/);
  assert.match(script, /isAuthorizeSectionVisible/);
  assert.match(script, /status-close-btn/);
  assert.match(script, /setIsAuthorizeSectionVisible\(false\)/);
  assert.match(script, /isAuthorizeSectionVisible\s*&&\s*\(/);
});

test('app shell supports compact layout when authorize section is hidden', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.app-shell\.status-hidden\s*\{/);
  assert.match(css, /grid-template-rows:\s*29px\s+1fr;/);
  assert.match(css, /\.app-shell\.status-hidden\s+\.panel\s*\{[\s\S]*height:\s*100%;/);
  assert.match(css, /padding:\s*9px\s+10px\s+8px;/);
});
