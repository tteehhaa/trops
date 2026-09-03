const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'precheck.html'), 'utf8');

test('기본입력 다섯 축을 점수와 분리된 의미 코드로 넘긴다', () => {
  for (const code of [
    'north_america_japan_western_europe',
    'five_plus_no_delay',
    'partial',
    'd60',
    'not_insured',
  ]) {
    assert.ok(source.includes(`'${code}'`), `${code} 전달 코드가 없다`);
  }
  assert.match(source, /key:'buyer',send:true[^\n]*fc:'buyer'/);
});

test('전액 선지급의 계산용 보험 만점을 가입 답변으로 넘기지 않는다', () => {
  assert.ok(
    source.includes("if(!(prepaid&&f.key==='ins')&&f.send&&f.cd[v])"),
    '비활성 보험 칸을 전달에서 제외하는 경계가 없다'
  );
});
