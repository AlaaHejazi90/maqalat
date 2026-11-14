// يبني الموقع من articles.json و config.json إلى مجلد public/
// يشتغل تلقائياً على Vercel أو Netlify. ما يحتاج أي مكتبات.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "public");

function fail(msg) {
  console.error("\n❌ " + msg + "\n");
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  } catch (e) {
    fail(`فيه خطأ في ملف ${file}: تأكد من الفواصل وعلامات التنصيص.\n${e.message}`);
  }
}

const config = readJson("config.json");
const articles = readJson("articles.json");

const SITE = (
  config.siteUrl ||
  process.env.URL || // Netlify
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "") ||
  ""
).replace(/\/+$/, "");
if (!SITE) console.warn("⚠️ siteUrl فاضي: روابط الصور لازم تكون كاملة (تبدأ بـ https).");

// ---------- تحقق من البيانات ----------
if (!Array.isArray(articles)) fail("articles.json لازم يكون قائمة [ ... ]");
const seen = new Set();
articles.forEach((a, i) => {
  const n = `المقالة رقم ${i + 1}`;
  if (!a.slug || !/^[a-z0-9-]+$/.test(a.slug)) fail(`${n}: slug لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة (-) فقط.`);
  if (seen.has(a.slug)) fail(`${n}: slug «${a.slug}» مكرر.`);
  seen.add(a.slug);
  if (!a.url || !/^https?:\/\//.test(a.url)) fail(`${n}: رابط المقالة (url) ناقص أو غلط.`);
  if (!a.title) fail(`${n}: العنوان (title) ناقص.`);
});
articles.forEach((a) => { const c0 = Array.isArray(a.cards) && a.cards[0]; if (c0) { if (!a.image) a.image = c0.image; if (!a.description) a.description = c0.quote; } });
articles.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

// ---------- أدوات ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const abs = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : SITE + "/" + u.replace(/^\/+/, ""));
const pageUrl = (a) => `${SITE}/a/${a.slug}`;
const fmtDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
};

const GC = (config.goatcounter || "").trim();
const counterJs = GC
  ? `function count(p,t){try{fetch("https://${GC}.goatcounter.com/count?p="+encodeURIComponent(p)+"&t="+encodeURIComponent(t||"")+"&r="+encodeURIComponent(document.referrer)+"&rnd="+Math.random(),{mode:"no-cors",keepalive:true,credentials:"omit"})}catch(e){}}`
  : `function count(){}`;

function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

// ---------- تنظيف وإعداد ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(path.join(ROOT, "images"))) fs.cpSync(path.join(ROOT, "images"), path.join(OUT, "images"), { recursive: true });

// ---------- 1) صفحة التحويل لكل مقالة: /a/slug ----------
function redirectPage(a, sub, image, description) {
  const img = abs(image);
  const desc = description || config.intro || "";
  const purl = pageUrl(a) + (sub ? "/" + sub : "");
  const cpath = "/" + a.slug + (sub ? "/" + sub : "");
  write(
    `a/${a.slug}${sub ? "/" + sub : ""}/index.html`,
    `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.title)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:locale" content="ar_AR">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(purl)}">
${img ? `<meta property="og:image" content="${esc(img)}">\n<meta name="twitter:image" content="${esc(img)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.title)}">
<meta name="twitter:description" content="${esc(desc)}">
${config.xHandle ? `<meta name="twitter:creator" content="@${esc(config.xHandle)}">` : ""}
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#f7f7f5;color:#222;text-align:center;padding:16px}
@media (prefers-color-scheme:dark){body{background:#151515;color:#eee}}
a{color:#0b7a5a}
</style>
</head>
<body>
<p>جاري فتح المقالة في صحيفة سبق…<br><a href="${esc(a.url)}">اضغط هنا إذا ما انفتحت</a></p>
<script>
(function(){
${counterJs}
var q=new URLSearchParams(location.search);
var src=(q.get("src")||"direct").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,20)||"direct";
count("${cpath}/"+src, ${js(a.title)});
location.replace(${js(a.url)});
})();
</script>
</body>
</html>`
  );
}
for (const a of articles) {
  redirectPage(a, "", a.image, a.description);
  (Array.isArray(a.cards) ? a.cards : []).forEach((c, i) => redirectPage(a, String(i + 1), c.image || a.image, c.quote || a.description));
}

// ---------- 2) الصفحة الرئيسية: قائمة المقالات (تظهر في قوقل) ----------
const cards = articles
  .map(
    (a) => `<article class="card">
  <a href="${esc(a.url)}" target="_blank" rel="noopener" data-slug="${esc(a.slug)}" data-title="${esc(a.title)}">
    ${a.image ? `<img src="${esc(abs(a.image))}" alt="${esc(a.title)}" loading="lazy">` : ""}
    <div class="body">
      ${a.date ? `<time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>` : ""}
      <h2>${esc(a.title)}</h2>
      ${a.description ? `<p>${esc(a.description)}</p>` : ""}
      <span class="more">اقرأ المقال في سبق ←</span>
    </div>
  </a>
</article>`
  )
  .join("\n");

const latestImg = abs(articles[0]?.image);
const ld = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    name: config.author,
    jobTitle: config.authorTitle,
    sameAs: config.xHandle ? ["https://x.com/" + config.xHandle] : [],
  },
  hasPart: articles.map((a) => ({ "@type": "OpinionNewsArticle", headline: a.title, url: a.url, datePublished: a.date || undefined, image: abs(a.image) || undefined })),
};

write(
  "index.html",
  `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.author)} | مقالات الرأي</title>
<meta name="description" content="${esc(config.intro)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(config.author)} | مقالات الرأي">
<meta property="og:description" content="${esc(config.intro)}">
${SITE ? `<meta property="og:url" content="${esc(SITE)}/">\n<link rel="canonical" href="${esc(SITE)}/">` : ""}
${latestImg ? `<meta property="og:image" content="${esc(latestImg)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${js(ld)}</script>
<style>
:root{--bg:#f7f7f5;--card:#fff;--text:#1f1f1f;--muted:#666;--accent:#0b7a5a;--line:#e6e6e2}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--card:#1d1d1d;--text:#eee;--muted:#aaa;--accent:#4cc79d;--line:#2c2c2c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.7}
header{max-width:960px;margin:0 auto;padding:48px 16px 24px}
header h1{margin:0;font-size:clamp(1.6rem,4vw,2.2rem)}
header .role{color:var(--accent);font-weight:600;margin:4px 0 8px}
header p{color:var(--muted);margin:0}
main{max-width:960px;margin:0 auto;padding:8px 16px 48px;display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .15s}
.card:hover{transform:translateY(-3px)}
.card a{color:inherit;text-decoration:none;display:block;height:100%}
.card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--line)}
.body{padding:16px}
time{font-size:.85rem;color:var(--muted)}
h2{font-size:1.15rem;margin:4px 0 8px;line-height:1.5}
.body p{margin:0 0 12px;color:var(--muted);font-size:.95rem}
.more{color:var(--accent);font-weight:600;font-size:.95rem}
footer{text-align:center;color:var(--muted);font-size:.85rem;padding:0 16px 32px}
footer a{color:var(--accent)}
</style>
</head>
<body>
<header>
  <h1>${esc(config.author)}</h1>
  <div class="role">${esc(config.authorTitle)}</div>
  <p>${esc(config.intro)}</p>
</header>
<main>
${cards}
</main>
<footer>${config.xHandle ? `<a href="https://x.com/${esc(config.xHandle)}" rel="me">@${esc(config.xHandle)}</a>` : ""}</footer>
<script>
(function(){
${counterJs}
document.querySelectorAll("a[data-slug]").forEach(function(el){
  el.addEventListener("click",function(){count("/"+el.dataset.slug+"/site",el.dataset.title)});
});
})();
</script>
</body>
</html>`
);

// ---------- 3) صفحة الروابط والقوالب (لك أنت فقط): /links ----------
const channels = config.channels || {};
const templates = config.templates || {};
const linksData = articles.map((a) => {
  const cards = Array.isArray(a.cards) ? a.cards : [];
  const variants = cards.length
    ? cards.map((c, i) => ({ label: "بطاقة " + (i + 1), quote: c.quote || "", hook: c.quote || a.hook || "", description: c.quote || a.description || "", link: pageUrl(a) + "/" + (i + 1) }))
    : [{ label: "", quote: "", hook: a.hook || "", description: a.description || "", link: pageUrl(a) }];
  return { slug: a.slug, title: a.title, url: a.url, image: abs(a.image), date: fmtDate(a.date), iso: a.date || "", variants };
});

write(
  "links/index.html",
  `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>روابط المقالات</title>
<style>
:root{--bg:#f4f3f0;--card:#fff;--soft:#f8f7f4;--text:#1f1d1a;--muted:#6b665e;--accent:#0b7a5a;--accent-fg:#fff;--line:#e4e1da;--ok:#2e7d32}
@media (prefers-color-scheme:dark){:root{--bg:#121211;--card:#1c1b19;--soft:#232220;--text:#efece6;--muted:#a59f95;--accent:#4cc79d;--accent-fg:#0f1f19;--line:#2e2c29;--ok:#6cc08f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.6}
.wrap{max-width:960px;margin:0 auto;padding:28px 16px 56px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:8px 16px;margin-bottom:18px}
h1{margin:0;font-size:1.6rem}
.stats{font-size:.9rem;color:var(--muted)}
.stats a{color:var(--accent);font-weight:600;text-decoration:none}
.warn{background:#fff4d6;color:#6b4e00;border-radius:10px;padding:10px 14px;margin-bottom:16px}
.tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:18px;scrollbar-width:thin}
.tab{flex:0 0 auto;font:inherit;font-size:.9rem;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:7px 16px;cursor:pointer;white-space:nowrap}
.tab[aria-pressed="true"]{background:var(--accent);color:var(--accent-fg);border-color:var(--accent);font-weight:600}
.art{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:22px}
.head{display:flex;gap:16px;align-items:center;padding:16px;border-bottom:1px solid var(--line)}
.head img{width:132px;aspect-ratio:16/9;object-fit:cover;border-radius:10px;flex:0 0 auto;background:var(--soft)}
.head .t{min-width:0}
.head h2{margin:0 0 4px;font-size:1.15rem;line-height:1.5;text-wrap:balance}
.head .m{font-size:.85rem;color:var(--muted)}
.head .m a{color:var(--accent);text-decoration:none;font-weight:600}
@media (max-width:520px){.head{gap:12px}.head img{width:96px}}
.variant{padding:16px}
.variant+.variant{border-top:1px dashed var(--line)}
.vlabel{display:flex;gap:10px;align-items:baseline;margin-bottom:12px}
.vlabel b{background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:.8rem;white-space:nowrap}
.vlabel span{color:var(--muted);font-size:.9rem}
.grid{border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tile{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:10px 14px;background:var(--soft)}
.tile+.tile{border-top:1px solid var(--line)}
.tile .n{display:flex;align-items:center;gap:8px;font-weight:600;min-width:150px}
.dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.tile .n small{margin-inline-start:auto;color:var(--muted);font-weight:400;direction:ltr;font-family:ui-monospace,Menlo,monospace;font-size:.75rem}
.btns{display:flex;gap:8px}
.btns .b{min-width:110px}
@media (max-width:520px){.tile{flex-direction:column;align-items:stretch}.btns{display:grid;grid-template-columns:1fr 1fr}.btns .b{min-width:0}}
button.b{font:inherit;font-size:.85rem;border-radius:9px;padding:8px 6px;cursor:pointer;border:1px solid var(--accent);background:transparent;color:var(--accent)}
button.b.main{background:var(--accent);color:var(--accent-fg)}
button.b.ok{background:var(--ok);border-color:var(--ok);color:#fff}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>روابط المقالات</h1>
  ${GC ? `<div class="stats">📊 الإحصائيات: <a href="https://${esc(GC)}.goatcounter.com" target="_blank" rel="noopener">${esc(GC)}.goatcounter.com</a></div>` : ""}
</header>
${GC ? "" : `<div class="warn">العدّاد غير مفعّل. أضف اسم حساب GoatCounter في config.json.</div>`}
<div class="tabs" id="tabs" role="group" aria-label="الأسابيع"></div>
<div id="list"></div>
</div>
<script>
var ARTS=${js(linksData)};
var CH=${js(channels)};
var TPL=${js(templates)};
var AUTHOR=${js(config.author)};
var COLORS={wa:"#25D366",li:"#0A66C2",x:"#888",tg:"#229ED9",em:"#c4683e"};
var NL=String.fromCharCode(10);
function fill(t,a,v,link){var vals={title:a.title,hook:v.hook,description:v.description,link:link,author:AUTHOR};Object.keys(vals).forEach(function(k){t=t.split("{"+k+"}").join(vals[k]||"")});while(t.indexOf(NL+NL+NL)>-1)t=t.split(NL+NL+NL).join(NL+NL);return t.trim()}
function copy(text,btn){var done=function(){var o=btn.textContent;btn.classList.add("ok");btn.textContent="تم النسخ ✓";setTimeout(function(){btn.classList.remove("ok");btn.textContent=o},1500)};if(navigator.clipboard){navigator.clipboard.writeText(text).then(done,function(){fallback(text);done()})}else{fallback(text);done()}}
function fallback(text){var t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();try{document.execCommand("copy")}catch(e){}t.remove()}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function wk(d){if(!d)return "0";var t=new Date(d+"T12:00:00Z");if(isNaN(t))return "0";t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+1)%7));return t.toISOString().slice(0,10)}
var groups={};ARTS.forEach(function(a){var k=wk(a.iso);(groups[k]=groups[k]||[]).push(a)});
var keys=Object.keys(groups).sort().reverse();
var tabs=document.getElementById("tabs"),root=document.getElementById("list"),panes={};
keys.forEach(function(k,i){var b=el("button","tab",i===0?"الأسبوع الحالي":(k==="0"?"بدون تاريخ":"أسبوع "+new Date(k+"T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory",{day:"numeric",month:"long"})));b.type="button";b.onclick=function(){show(k)};tabs.append(b);var p=el("div");root.append(p);panes[k]={b:b,p:p}});
function show(k){keys.forEach(function(x){panes[x].p.hidden=x!==k;panes[x].b.setAttribute("aria-pressed",String(x===k))})}
ARTS.forEach(function(a){
  var box=el("section","art"),head=el("div","head");
  if(a.image){var im=el("img");im.src=a.image;im.alt="";im.loading="lazy";head.append(im)}
  var t=el("div","t");t.append(el("h2",null,a.title));var m=el("div","m",a.date+" · ");var s=el("a",null,"افتح في سبق ↗");s.href=a.url;s.target="_blank";s.rel="noopener";m.append(s);t.append(m);head.append(t);box.append(head);
  a.variants.forEach(function(v){
    var sec=el("div","variant");
    if(v.label){var l=el("div","vlabel");l.append(el("b",null,v.label));l.append(el("span",null,v.quote));sec.append(l)}
    var g=el("div","grid");
    Object.keys(CH).forEach(function(k){
      var link=v.link+"?src="+k,tile=el("div","tile"),n=el("div","n"),dot=el("span","dot");dot.style.background=COLORS[k]||"var(--accent)";
      n.append(dot,el("span",null,CH[k]),el("small",null,"src="+k));
      var bt=el("div","btns"),b1=el("button","b","نسخ الرابط");b1.type="button";b1.title=link;b1.onclick=function(){copy(link,b1)};bt.append(b1);
      if(TPL[k]){var b2=el("button","b main","نسخ المنشور");b2.type="button";b2.onclick=function(){copy(fill(TPL[k],a,v,link),b2)};bt.append(b2)}
      tile.append(n,bt);g.append(tile)});
    sec.append(g);box.append(sec)});
  panes[wk(a.iso)].p.append(box)});
if(keys.length)show(keys[0]);
</script>
</body>
</html>`
);

// ---------- 4) robots + sitemap ----------
write("robots.txt", `User-agent: *\nAllow: /\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ""}`);
if (SITE) {
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(SITE)}/</loc><lastmod>${esc(articles[0]?.date || new Date().toISOString().slice(0, 10))}</lastmod></url>\n</urlset>\n`
  );
}

console.log(`✅ تم البناء: ${articles.length} مقالة → public/  (الموقع: ${SITE || "غير محدد"})`);
