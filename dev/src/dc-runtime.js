// Mimipupu site runtime: renders the page template (holes, sc-if, sc-for) with React.
import * as React from 'react';
import { createRoot } from 'react-dom/client';

const h = React.createElement;

const EVENTS = {};
['Click', 'DoubleClick', 'Change', 'Input', 'KeyDown', 'KeyUp', 'KeyPress', 'PointerDown', 'PointerMove', 'PointerUp',
  'PointerCancel', 'PointerLeave', 'PointerEnter', 'PointerOver', 'PointerOut', 'Wheel', 'Focus', 'Blur', 'MouseEnter',
  'MouseLeave', 'MouseDown', 'MouseUp', 'MouseMove', 'Submit', 'Scroll', 'Load', 'Error', 'TouchStart', 'TouchEnd',
  'TouchMove', 'ContextMenu', 'DragStart', 'AnimationEnd', 'TransitionEnd']
  .forEach((n) => { EVENTS['on' + n.toLowerCase()] = 'on' + n; });

const ATTRS = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autocomplete: 'autoComplete', autofocus: 'autoFocus',
  readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan',
  crossorigin: 'crossOrigin', srcset: 'srcSet', contenteditable: 'contentEditable', inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint', referrerpolicy: 'referrerPolicy', fetchpriority: 'fetchPriority', spellcheck: 'spellCheck',
  viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace',
  novalidate: 'noValidate', allowfullscreen: 'allowFullScreen', playsinline: 'playsInline', autoplay: 'autoPlay',
  datetime: 'dateTime', enctype: 'encType', accesskey: 'accessKey', frameborder: 'frameBorder'
};
const BOOLS = new Set(['checked', 'disabled', 'selected', 'readOnly', 'required', 'multiple', 'autoFocus', 'hidden', 'open',
  'controls', 'autoPlay', 'loop', 'muted', 'noValidate', 'allowFullScreen', 'playsInline']);

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
const WHOLE = /^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/;

function literal(expr) {
  if (expr === 'true') return { v: true };
  if (expr === 'false') return { v: false };
  if (expr === 'null') return { v: null };
  if (expr === 'undefined') return { v: undefined };
  if (/^-?\d+(\.\d+)?$/.test(expr)) return { v: Number(expr) };
  const m = /^(['"])(.*)\1$/.exec(expr);
  if (m) return { v: m[2] };
  return null;
}

function compileExpr(expr) {
  const lit = literal(expr);
  if (lit) return () => lit.v;
  const parts = expr.split('.');
  return (scope) => {
    let v = scope[parts[0]];
    for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  };
}

function compileText(str) {
  const out = []; let last = 0; let m;
  HOLE.lastIndex = 0;
  while ((m = HOLE.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(compileExpr(m[1]));
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}
const toStr = (v) => (v == null || v === false ? '' : String(v));
function runText(parts, scope) {
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
  let s = '';
  for (const p of parts) s += typeof p === 'string' ? p : toStr(p(scope));
  return s;
}

const styleCache = new Map();
function parseStyle(text) {
  if (styleCache.has(text)) return styleCache.get(text);
  const obj = {};
  let depth = 0, quote = '', start = 0;
  const decls = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) { decls.push(text.slice(start, i)); start = i + 1; }
  }
  decls.push(text.slice(start));
  for (const d of decls) {
    const k = d.indexOf(':');
    if (k < 0) continue;
    let name = d.slice(0, k).trim(); const val = d.slice(k + 1).trim();
    if (!name) continue;
    if (!name.startsWith('--')) {
      name = name.toLowerCase();
      if (name.startsWith('-ms-')) name = 'ms' + camel(name.slice(3));
      else if (name.startsWith('-')) name = camel(name.slice(1)).replace(/^./, (c) => c.toUpperCase());
      else name = camel(name);
    }
    obj[name] = val;
  }
  if (styleCache.size > 4000) styleCache.clear();
  styleCache.set(text, obj);
  return obj;
}

function compileNode(node) {
  if (node.nodeType === 3) {
    const t = node.nodeValue;
    if (!t) return null;
    return { k: 't', parts: compileText(t) };
  }
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const kids = compileChildren(node.content ? node.content : node);
  if (tag === 'sc-if') {
    return { k: 'if', test: compileExpr((WHOLE.exec(node.getAttribute('value') || '') || [, 'false'])[1]), kids };
  }
  if (tag === 'sc-for') {
    return { k: 'for', list: compileExpr((WHOLE.exec(node.getAttribute('list') || '') || [, 'undefined'])[1]), as: node.getAttribute('as') || 'item', kids };
  }
  const attrs = [];
  const raw = {};
  for (const a of Array.from(node.attributes)) raw[a.name] = a.value;
  const names = Object.keys(raw);
  const hasChange = 'onchange' in raw;
  const valueBound = 'value' in raw;
  for (const name of names) {
    if (name.startsWith('hint-')) continue;
    let value = raw[name];
    let prop;
    if (EVENTS[name]) prop = EVENTS[name];
    else if (ATTRS[name]) prop = ATTRS[name];
    else if (name.startsWith('aria-') || name.startsWith('data-')) prop = name;
    else if (name.includes('-')) prop = camel(name);
    else prop = name;
    // a bound value with only onInput: let React treat it as onChange
    if (prop === 'onInput' && valueBound && !hasChange && (tag === 'input' || tag === 'textarea')) prop = 'onChange';
    if (prop === 'style') { attrs.push({ prop, style: compileText(value) }); continue; }
    const whole = WHOLE.exec(value);
    if (whole) { attrs.push({ prop, expr: compileExpr(whole[1]) }); continue; }
    if (value.includes('{{')) { attrs.push({ prop, text: compileText(value) }); continue; }
    if (BOOLS.has(prop) && (value === '' || value === prop.toLowerCase())) { attrs.push({ prop, stat: true }); continue; }
    attrs.push({ prop, stat: value });
  }
  let textValue = null;
  if (tag === 'textarea' && kids.length) {
    textValue = kids.filter((k) => k && k.k === 't').map((k) => k.parts).flat();
    kids.length = 0;
  }
  return { k: 'e', tag, attrs, kids, textValue };
}
function compileChildren(parent) {
  const out = [];
  for (const c of Array.from(parent.childNodes)) { const n = compileNode(c); if (n) out.push(n); }
  return out;
}

function renderList(nodes, scope, keyPrefix) {
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const r = renderNode(nodes[i], scope, keyPrefix + i);
    if (r == null || r === '') continue;
    out.push(r);
  }
  return out;
}
function renderNode(n, scope, key) {
  if (n.k === 't') return runText(n.parts, scope);
  if (n.k === 'if') {
    if (!n.test(scope)) return null;
    return h(React.Fragment, { key }, ...renderList(n.kids, scope, key + '.'));
  }
  if (n.k === 'for') {
    const list = n.list(scope);
    if (!list || !list.length) return null;
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const s = Object.create(scope);
      s[n.as] = list[i]; s.$index = i;
      items.push(h(React.Fragment, { key: i }, ...renderList(n.kids, s, key + ':' + i + '.')));
    }
    return h(React.Fragment, { key }, ...items);
  }
  const props = { key };
  for (const a of n.attrs) {
    let v;
    if (a.style) { const t = runText(a.style, scope); v = parseStyle(t); }
    else if (a.expr) v = a.expr(scope);
    else if (a.text) v = runText(a.text, scope);
    else v = a.stat;
    if (v === undefined) continue;
    props[a.prop] = v;
  }
  if (n.textValue) props.defaultValue = runText(n.textValue, scope);
  if ((n.tag === 'input' || n.tag === 'textarea') && 'value' in props && !props.onChange && !props.readOnly) {
    props.defaultValue = props.value; delete props.value;
  }
  if (n.tag === 'input' && 'checked' in props && !props.onChange && !props.readOnly) {
    props.defaultChecked = props.checked; delete props.checked;
  }
  const kids = renderList(n.kids, scope, key + '.');
  return kids.length ? h(n.tag, props, ...kids) : h(n.tag, props);
}

let TEMPLATE = [];
export class DCLogic extends React.Component {
  render() {
    const vals = this.renderVals ? this.renderVals() || {} : {};
    return h(React.Fragment, null, ...renderList(TEMPLATE, vals, 'r'));
  }
}

export function mount({ templateEl, Component, props, container }) {
  TEMPLATE = compileChildren(templateEl.content);
  const root = createRoot(container);
  root.render(h(Component, props));
  return root;
}
export { React };
