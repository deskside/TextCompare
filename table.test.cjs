const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes = {};
const get = id => nodes[id] ??= { value: '', hidden: true, disabled: true, textContent: '', innerHTML: '', children: [], addEventListener() {}, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } };
let tables = [];
const context = {
  document: { getElementById: get },
  window: { scrollY: 0, clearTimeout() {}, setTimeout(callback,delay) { this.timerCallback=callback;this.timerDelay=delay;return 1; }, addEventListener() {}, matchMedia: () => ({ matches: false }), scrollTo(options) { this.lastScroll = options; } },
  DOMParser: class { parseFromString() { return { querySelectorAll: () => tables }; } },
};
vm.createContext(context);
vm.runInContext(source, context);
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));
same(context.readTable('', 'old\tnew'), ['old', 'new']);
same(context.readTable('', '"old\nline"\t"new"\r\n'), ['old\nline', 'new']);
same(context.readTable('', '\t'), ['', '']);
same(context.readTable('', '"a""b"\tx'), ['a"b', 'x']);
for (const text of ['a\tb\nc\td', 'a\tb\tc', 'one cell', '"unclosed']) {
  assert.throws(() => context.readTable('', text));
}
const text = value => ({ nodeType: 3, nodeValue: value });
const cell = value => ({ colSpan: 1, rowSpan: 1, childNodes: [text(value)] });
tables = [{ rows: [{ cells: [cell('old'), cell('new')] }] }];
same(context.readTable('<table></table>', ''), ['old', 'new']);
tables[0].rows[0].cells[0].colSpan = 2;
assert.throws(() => context.readTable('<table></table>', 'old\tnew'));
tables = [{ rows: [{ cells: [cell('old'), cell('new')] }, { cells: [] }] }];
assert.throws(() => context.readTable('<table></table>', 'old\tnew'));
same(context.cellText({ childNodes: [
  { nodeType: 1, tagName: 'P', childNodes: [text('first')] },
  { nodeType: 1, tagName: 'P', childNodes: [text('second')] },
] }), 'first\nsecond');
let copied;
context.writeRich = (html, plain) => { copied = { html, plain }; };
get('oldResult').innerHTML = '<span style="color:#c32946">old</span>';
get('newResult').innerHTML = '<span style="color:#5883bf">new</span>';
get('oldResult').textContent = 'old';
get('newResult').textContent = 'new';
get('copyTable').onclick();
assert.equal((copied.html.match(/<td /g) || []).length, 2);
assert(copied.html.includes('border="0"'));
assert(copied.html.includes('#c32946') && copied.html.includes('#5883bf'));
assert(copied.html.includes('font-size:10pt'));
same(context.readTable('', copied.plain), ['old', 'new']);
get('copyTable').disabled = false;
context.invalidate();
assert(get('copyTable').disabled);
context.setCopyEnabled(true);
for (const id of ['copyOld', 'copyNew', 'copyTable', 'copyOldBottom', 'copyNewBottom', 'copyTableBottom']) assert.equal(get(id).disabled, false);
context.invalidate();
for (const id of ['copyOld', 'copyNew', 'copyTable', 'copyOldBottom', 'copyNewBottom', 'copyTableBottom']) assert.equal(get(id).disabled, true);
assert.equal(get('copyOld').onclick, get('copyOldBottom').onclick);
assert.equal(get('copyNew').onclick, get('copyNewBottom').onclick);
assert.equal(get('copyTable').onclick, get('copyTableBottom').onclick);
assert.equal(get('backToTop').hidden, true);
same(context.countChanges(context.tokens('甲A1， \n乙'), new Set([0, 1])), 2);
same(context.countChanges(context.tokens('， \n'), new Set()), 0);
const measuredSpans = [];
context.document.createElement = () => ({ style: {}, getClientRects: () => [
  { top: 120, width: 18, height: 16 },
  { top: 140, width: 18, height: 16 },
] });
context.getComputedStyle = () => ({ lineHeight: '20px' });
const target = { style: {}, clientTop: 1, replaceChildren() { measuredSpans.length = 0; }, append(span) { measuredSpans.push(span); }, getBoundingClientRect: () => ({ top: 100 }) };
context.render(target, '甲乙', new Set([0]), '#c32946');
context.paintChangedLines(target, '#c3294614');
assert.equal(target.style.backgroundImage.split('linear-gradient').length - 1, 2);
assert.equal(target.style.backgroundPosition, '0 17px,0 37px');
assert(measuredSpans.every(span => !span.style.backgroundImage && !span.style.backgroundColor));
context.render(target, '甲乙', new Set([0, 1]), '#c32946');
context.paintChangedLines(target, '#c3294614');
assert.equal(target.style.backgroundImage, 'none');
context.window.scrollY = 301;
context.updateBackToTop();
assert.equal(get('backToTop').hidden, false);
get('backToTop').onclick();
assert.equal(context.window.lastScroll.top, 0);
assert.equal(context.window.lastScroll.behavior, 'smooth');
context.window.matchMedia = () => ({ matches: true });
get('backToTop').onclick();
assert.equal(context.window.lastScroll.behavior, 'instant');
context.window.scrollY = 0;
context.updateBackToTop();
assert.equal(get('backToTop').hidden, true);
context.window.matchMedia = () => ({ matches: false });
context.document.createElement = () => ({ style: { setProperty(key,value) { this[key]=value; } } });
context.celebrate();
assert.equal(get('fireworks').children.length,54);
assert.equal(context.window.timerDelay,2000);
context.celebrate();
assert.equal(get('fireworks').children.length,54);
context.window.timerCallback();
assert.equal(get('fireworks').children.length,0);
context.setStatus('done','complete');
get('results').hidden=false;
context.invalidate();
assert.equal(get('status').className,'changed');
assert.equal(get('status').textContent,'输入已改变，请重新对比后复制！');
assert.equal(get('fireworks').children.length,0);
context.window.matchMedia = () => ({ matches: true });
context.celebrate();
assert.equal(get('fireworks').children.length,54);
context.window.timerCallback();
assert.equal(get('fireworks').children.length,0);
get('old').value='';get('new').value='';
context.compare();
assert.equal(get('status').className,'');
assert.equal(get('fireworks').children.length,0);
console.log('Passed table, counting, line-highlight, fireworks cleanup, reduced-motion and input-status checks.');
