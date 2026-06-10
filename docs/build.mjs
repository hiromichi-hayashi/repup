// RepUp 設計資料ビルダー
// docs/*.md を読み、お手本(create-txt-book)と同じ共通テンプレートで docs/html/*.html を生成する。
// Markdown が正本。HTML は決定論的に再生成できる。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const DOCS = dirname(fileURLToPath(import.meta.url));
const OUT = join(DOCS, 'html');

const BRAND = {
  logo: 'RepUp',
  tag: '筋トレを、いかなきゃの気持ちに。',
  ver: 'MVP 設計資料 / 全7文書',
  foot: '設計書は相互整合済み。技術スタック・通知設計・ロードマップはこれに準拠。',
};

// ナビ順 = ファイル名昇順。number / title はファイル先頭の HTML コメントから取得。
//   <!-- nav: 02 | 機能設計 -->
function meta(md, fallbackNo) {
  const m = md.match(/<!--\s*nav:\s*([^|]+)\|\s*([^\n>]+?)\s*-->/);
  return m ? { no: m[1].trim(), navt: m[2].trim() } : { no: fallbackNo, navt: '' };
}

// slug 化(TOC アンカー用)。日本語はそのまま、空白と記号をハイフンに。
function slugify(text, used) {
  let s = text.trim().toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w　-鿿＀-￯]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) s = 'sec';
  let base = s, i = 2;
  while (used.has(s)) { s = `${base}-${i++}`; }
  used.add(s);
  return s;
}

function build() {
  const files = readdirSync(DOCS)
    .filter((f) => /^\d2.*\.md$/.test(f) || /^\d{2}_.*\.md$/.test(f))
    .filter((f) => f.endsWith('.md'))
    .sort();

  const docs = files.map((file) => {
    const md = readFileSync(join(DOCS, file), 'utf8');
    const { no, navt } = meta(md, file.slice(0, 2));
    return { file, html: file.replace(/\.md$/, '.html'), md, no, navt };
  });

  for (let idx = 0; idx < docs.length; idx++) {
    const doc = docs[idx];
    const used = new Set();
    const toc = [];

    const renderer = new marked.Renderer();
    const baseHeading = renderer.heading.bind(renderer);
    renderer.heading = (text, level, raw) => {
      if (level === 2 || level === 3) {
        const id = slugify(typeof raw === 'string' ? raw : text, used);
        toc.push({ level, id, text: (typeof raw === 'string' ? raw : text).replace(/<[^>]+>/g, '') });
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      }
      return baseHeading(text, level, raw);
    };

    // タイトル行(最初の # )を doc-head に昇格、本文からは除く。
    let body = doc.md;
    const h1 = body.match(/^#\s+(.+)$/m);
    const title = h1 ? h1[1].trim() : doc.navt;
    body = body.replace(/<!--[\s\S]*?-->/g, '').replace(/^#\s+.+$/m, '').trim();

    const contentHtml = marked.parse(body, { renderer, mangle: false, headerIds: false });

    const nav = docs.map((d) =>
      `<a href="${d.html}"${d === doc ? ' class="active"' : ''}><span class="nav-no">${d.no}</span><span class="nav-t">${d.navt}</span></a>`
    ).join('\n');

    const tocHtml = toc.map((t) =>
      `<a href="#${t.id}" class="toc-l${t.level}">${t.text}</a>`
    ).join('\n');

    const prev = docs[idx - 1];
    const next = docs[idx + 1];
    const pager = `<nav class="pager">${
      prev ? `<a href="${prev.html}"><div class="dir">← PREV</div><div class="t">${prev.no} ${prev.navt}</div></a>` : '<span class="ph"></span>'
    }${
      next ? `<a href="${next.html}" class="next"><div class="dir">NEXT →</div><div class="t">${next.no} ${next.navt}</div></a>` : '<span class="ph"></span>'
    }</nav>`;

    const page = TEMPLATE
      .replace(/__DOCNO__/g, doc.no)
      .replace(/__TITLE__/g, title)
      .replace('__NAV__', nav)
      .replace('__TOC__', tocHtml)
      .replace('__CONTENT__', contentHtml)
      .replace('__PAGER__', pager);

    writeFileSync(join(OUT, doc.html), page, 'utf8');
    console.log(`  ✓ ${doc.html}`);
  }

  const first = docs[0]?.html ?? '01_concept.html';
  writeFileSync(join(OUT, 'index.html'),
    `<!DOCTYPE html>\n<html lang="ja"><head><meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=${first}">\n<title>${BRAND.logo} 設計資料</title></head>\n<body><p><a href="${first}">${BRAND.logo} 設計資料を開く</a></p></body></html>\n`,
    'utf8');
  console.log(`  ✓ index.html`);
  console.log(`\nBuilt ${docs.length} docs → docs/html/`);
}

const STYLE = `:root{
  --ink:#16201a; --ink-soft:#3c4a42; --paper:#f5f3ee; --card:#fffdf8;
  --green:#1f5d3a; --green2:#2f8a55; --line:#e3ddd0; --line2:#d3ccbb;
  --accent:#c8551b; --code-bg:#16201a; --code-fg:#e7efe9;
  --shadow:0 1px 3px rgba(22,32,26,.06),0 8px 24px rgba(22,32,26,.05);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",YuGothic,"Noto Sans JP",sans-serif;
  font-size:15.5px;line-height:1.85;-webkit-font-smoothing:antialiased;}
.layout{display:flex;min-height:100vh}
.side{width:248px;flex:0 0 248px;background:var(--green);color:#e7efe9;
  position:sticky;top:0;height:100vh;overflow-y:auto;padding:28px 0;}
.brand{padding:0 26px 22px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:14px}
.brand .logo{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:23px;font-weight:600;letter-spacing:.04em;color:#fff}
.brand .tag{font-size:11.5px;color:#a7c9b4;margin-top:5px;letter-spacing:.04em}
.brand .ver{font-size:10.5px;color:#86b099;margin-top:10px}
.side a{display:flex;align-items:center;gap:11px;padding:11px 26px;color:#c3dccd;
  text-decoration:none;font-size:13.5px;border-left:3px solid transparent;transition:.15s;}
.side a:hover{background:rgba(255,255,255,.06);color:#fff}
.side a.active{background:rgba(255,255,255,.10);color:#fff;border-left-color:var(--accent)}
.nav-no{font-family:"SFMono-Regular",Consolas,monospace;font-size:11px;color:#86b099;font-weight:600}
.side a.active .nav-no{color:var(--accent)}
.side-foot{padding:18px 26px 0;margin-top:12px;border-top:1px solid rgba(255,255,255,.12);font-size:11px;color:#86b099;line-height:1.7}
.main{flex:1;min-width:0;display:flex;justify-content:center;padding:0}
.wrap{max-width:1180px;width:100%;display:grid;grid-template-columns:1fr 232px;gap:0}
.content{padding:54px 56px 120px;min-width:0}
.doc-head{margin-bottom:38px;padding-bottom:26px;border-bottom:2px solid var(--green)}
.doc-head .kicker{font-family:"SFMono-Regular",Consolas,monospace;font-size:12px;color:var(--green2);letter-spacing:.18em;font-weight:600}
.doc-head h1{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:33px;line-height:1.3;margin:10px 0 0;color:var(--ink);font-weight:600;letter-spacing:.01em}
.toc{position:sticky;top:0;align-self:start;padding:54px 24px 40px 8px;max-height:100vh;overflow-y:auto;font-size:12.5px}
.toc-title{font-family:"SFMono-Regular",Consolas,monospace;font-size:11px;letter-spacing:.16em;color:var(--green2);font-weight:700;margin-bottom:12px;text-transform:uppercase}
.toc a{display:block;color:var(--ink-soft);text-decoration:none;padding:3px 0 3px 11px;border-left:2px solid var(--line2);line-height:1.5;transition:.15s}
.toc a:hover{color:var(--green);border-left-color:var(--green2)}
.toc a.toc-l3{padding-left:24px;font-size:11.5px;color:#7c8a80}
.content h2{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:24px;margin:52px 0 18px;padding-top:14px;color:var(--green);font-weight:600;letter-spacing:.01em;border-top:1px solid var(--line)}
.content h2:first-of-type{border-top:none;padding-top:0;margin-top:8px}
.content h3{font-size:18.5px;margin:34px 0 12px;color:var(--ink);font-weight:600}
.content h4{font-size:15.5px;margin:24px 0 8px;color:var(--accent);font-weight:700;letter-spacing:.02em}
.content p{margin:13px 0;color:var(--ink-soft)}
.content strong{color:var(--ink);font-weight:700}
.content a{color:var(--green2);text-decoration:none;border-bottom:1px solid rgba(47,138,85,.3)}
.content a:hover{border-bottom-color:var(--green2)}
.content ul,.content ol{margin:13px 0;padding-left:24px;color:var(--ink-soft)}
.content li{margin:5px 0}
.content hr{border:none;border-top:1px solid var(--line);margin:34px 0}
.content code{font-family:"SFMono-Regular",Consolas,"Courier New",monospace;font-size:.86em;background:#ece6da;color:#9a4516;padding:2px 6px;border-radius:4px}
.content pre{background:var(--code-bg);color:var(--code-fg);padding:18px 20px;border-radius:8px;overflow-x:auto;margin:18px 0;line-height:1.65;box-shadow:var(--shadow)}
.content pre code{background:none;color:var(--code-fg);padding:0;font-size:13px}
.content table{border-collapse:collapse;width:100%;margin:20px 0;font-size:13.5px;background:var(--card);box-shadow:var(--shadow);border-radius:8px;overflow:hidden}
.content th{background:var(--green);color:#fff;text-align:left;padding:11px 14px;font-weight:600;font-size:13px;letter-spacing:.02em}
.content td{padding:10px 14px;border-top:1px solid var(--line);color:var(--ink-soft);vertical-align:top}
.content tr:nth-child(even) td{background:rgba(227,221,208,.22)}
.content blockquote{margin:18px 0;padding:14px 20px;background:#f3f7ee;border-left:4px solid var(--accent);border-radius:0 6px 6px 0;color:var(--ink-soft)}
.content blockquote p{margin:6px 0}
.content blockquote strong{color:var(--accent)}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:64px;padding-top:28px;border-top:1px solid var(--line)}
.pager a{flex:1;text-decoration:none;padding:16px 20px;background:var(--card);border:1px solid var(--line);border-radius:8px;transition:.15s;box-shadow:var(--shadow)}
.pager a:hover{border-color:var(--green2);transform:translateY(-1px)}
.pager .dir{font-size:11px;color:var(--green2);font-family:monospace;letter-spacing:.1em}
.pager .t{font-size:14.5px;color:var(--ink);font-weight:600;margin-top:3px}
.pager .next{text-align:right}
.pager .ph{flex:1}
@media(max-width:1080px){.wrap{grid-template-columns:1fr}.toc{display:none}.content{padding:40px 32px 90px}}
@media(max-width:720px){.side{position:fixed;z-index:50;transform:translateX(-100%);transition:.2s}.side.open{transform:none}.content{padding:32px 20px 80px}.menu-btn{display:flex!important}}
.menu-btn{display:none;position:fixed;top:14px;left:14px;z-index:60;width:44px;height:44px;border-radius:9px;background:var(--green);color:#fff;border:none;align-items:center;justify-content:center;font-size:20px;cursor:pointer;box-shadow:var(--shadow)}`;

const TEMPLATE = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>__DOCNO__ __TITLE__ | ${BRAND.logo} 設計資料</title>
<style>
${STYLE}
</style>
</head>
<body>
<button class="menu-btn" onclick="document.querySelector('.side').classList.toggle('open')">☰</button>
<div class="layout">
  <aside class="side">
    <div class="brand">
      <div class="logo">${BRAND.logo}</div>
      <div class="tag">${BRAND.tag}</div>
      <div class="ver">${BRAND.ver}</div>
    </div>
    <nav>__NAV__</nav>
    <div class="side-foot">${BRAND.foot}</div>
  </aside>
  <div class="main">
    <div class="wrap">
      <article class="content">
        <div class="doc-head">
          <div class="kicker">DOCUMENT __DOCNO__</div>
          <h1>__TITLE__</h1>
        </div>
        __CONTENT__
        __PAGER__
      </article>
      <aside class="toc">
        <div class="toc-title">On this page</div>
        __TOC__
      </aside>
    </div>
  </div>
</div>
</body>
</html>
`;

build();
