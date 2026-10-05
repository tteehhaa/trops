const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'contact.html'), 'utf8');

test('contact displays the enforced inquiry and launch notification retention periods', () => {
  const inquiry = source.match(/var KEEP_INQUIRY\s*=\s*'([^']+)'/)[1];
  const notification = source.match(/var RETENTION\s*=\s*\{[\s\S]*?notify:\s*'([^']+)'/)[1];
  assert.match(inquiry, /접수일부터 6개월\(183일\)/);
  assert.match(notification, /접수일부터 1년\(365일\)/);
  assert.match(source, /consult:\s*KEEP_INQUIRY/);
  assert.match(source, /quote:\s*KEEP_INQUIRY/);
  assert.match(source, /\$\('c-keep'\)\.textContent\s*=\s*RETENTION\[type\]/);
});
