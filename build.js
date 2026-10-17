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
const linksData = articles.flatMap((a) => {
  const base = { slug: a.slug, title: a.title, description: a.description || "", hook: a.hook || "", date: fmtDate(a.date), iso: a.date || "", link: pageUrl(a) };
  if (!Array.isArray(a.cards) || !a.cards.length) return [base];
  return a.cards.map((c, i) => ({ ...base, label: "بطاقة " + (i + 1) + ": " + (c.quote || ""), hook: c.quote || base.hook, description: c.quote || base.description, link: pageUrl(a) + "/" + (i + 1) }));
});

write(
  "links/index.html",
  `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>الروابط والقوالب</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--text:#1f1f1f;--muted:#666;--accent:#0b7a5a;--line:#e6e6e2}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--card:#1d1d1d;--text:#eee;--muted:#aaa;--accent:#4cc79d;--line:#2c2c2c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.6}
.wrap{max-width:860px;margin:0 auto;padding:32px 16px 48px}
h1{margin:0 0 4px}
.hint{color:var(--muted);margin:0 0 24px}
.art{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:20px}
.art h2{font-size:1.1rem;margin:0 0 4px}
.art .d{color:var(--muted);font-size:.85rem;margin-bottom:12px}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0;border-top:1px solid var(--line)}
.row b{min-width:110px}
.row code{flex:1 1 220px;direction:ltr;text-align:left;font-size:.85rem;background:var(--bg);padding:6px 8px;border-radius:8px;overflow-wrap:anywhere}
button{font:inherit;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:8px;padding:6px 12px;cursor:pointer}
button.main{background:var(--accent);color:#fff}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}.tab{border-radius:999px}.tab[aria-pressed="true"]{background:var(--accent);color:#fff}
button.ok{background:#2e7d32;border-color:#2e7d32;color:#fff}
${GC ? "" : ".warn{background:#fff4d6;color:#6b4e00;border-radius:10px;padding:10px 14px;margin-bottom:20px}@media (prefers-color-scheme:dark){.warn{background:#3a3000;color:#ffe08a}}"}
</style>
</head>
<body>
<div class="wrap">
<h1>الروابط والقوالب</h1>
<p class="hint">لكل قناة رابط خاص عشان نعرف كم ضغطة جت منها. «نسخ المنشور» ينسخ النص مع الرابط جاهز للصق.</p>
${GC ? `<p class="hint">📊 الإحصائيات: <a href="https://${esc(GC)}.goatcounter.com" target="_blank" rel="noopener">${esc(GC)}.goatcounter.com</a></p>` : `<div class="warn">العدّاد غير مفعّل. أضف اسم حساب GoatCounter في config.json (الحقل goatcounter).</div>`}
<div id="list"></div>
</div>
<script>
var ARTS=${js(linksData)};
var CH=${js(channels)};
var TPL=${js(templates)};
var AUTHOR=${js(config.author)};
function fill(t,a,link){return t.replace(/\\{(\\w+)\\}/g,function(m,k){return k==="link"?link:k==="author"?AUTHOR:(a[k]!=null?a[k]:"")}).replace(/\\n{3,}/g,"\\n\\n").trim()}
function copy(text,btn){
  var done=function(){var o=btn.textContent;btn.classList.add("ok");btn.textContent="تم النسخ ✓";setTimeout(function(){btn.classList.remove("ok");btn.textContent=o},1500)};
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(done,function(){fallback(text);done()})}else{fallback(text);done()}
}
function fallback(text){var t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();try{document.execCommand("copy")}catch(e){}t.remove()}
var root=document.getElementById("list");
function wk(d){if(!d)return "0";var t=new Date(d+"T12:00:00Z");if(isNaN(t))return "0";t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+1)%7));return t.toISOString().slice(0,10)}
var groups={};ARTS.forEach(function(a){var k=wk(a.iso);(groups[k]=groups[k]||[]).push(a)});
var keys=Object.keys(groups).sort().reverse();
var tabs=document.createElement("div");tabs.className="tabs";tabs.setAttribute("role","group");root.append(tabs);
var panes={};
keys.forEach(function(k,i){var b=document.createElement("button");b.type="button";b.className="tab";b.textContent=i===0?"الأسبوع الحالي":(k==="0"?"بدون تاريخ":"أسبوع "+new Date(k+"T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory",{day:"numeric",month:"long",year:"numeric"}));b.onclick=function(){show(k)};tabs.append(b);var p=document.createElement("div");root.append(p);panes[k]={b:b,p:p}});
function show(k){keys.forEach(function(x){panes[x].p.hidden=x!==k;panes[x].b.setAttribute("aria-pressed",String(x===k))})}
if(keys.length)show(keys[0]);
ARTS.forEach(function(a){var list=panes[wk(a.iso)].p;
  var box=document.createElement("section");box.className="art";
  box.innerHTML="<h2></h2><div class='d'></div>";
  box.querySelector("h2").textContent=a.title;
  box.querySelector(".d").textContent=(a.label?a.label+" · ":"")+a.date;
  Object.keys(CH).forEach(function(k){
    var link=a.link+"?src="+k;
    var row=document.createElement("div");row.className="row";
    var b=document.createElement("b");b.textContent=CH[k];
    var c=document.createElement("code");c.textContent=link;
    var b1=document.createElement("button");b1.textContent="نسخ الرابط";b1.onclick=function(){copy(link,b1)};
    row.append(b,c,b1);
    if(TPL[k]){var b2=document.createElement("button");b2.className="main";b2.textContent="نسخ المنشور";b2.onclick=function(){copy(fill(TPL[k],a,link),b2)};row.append(b2)}
    box.append(row);
  });
  list.append(box);
});
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
