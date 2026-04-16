# لوحة تحكم IPTV - Cloudflare Pages

## هيكل المشروع

```
cf-pages/
├── public/
│   └── index.html          ← واجهة المستخدم (HTML + JS)
├── functions/
│   ├── api/
│   │   ├── login.js        ← POST /api/login
│   │   ├── config.js       ← GET/POST /api/config
│   │   └── items.js        ← GET /api/items?cat=xxx
│   └── proxy/
│       └── [[path]].js     ← GET /proxy/video.m3u8?id=xxx
└── wrangler.toml
```

---

## خطوات النشر على Cloudflare Pages

### 1. إنشاء KV Namespace

افتح Cloudflare Dashboard ← Workers & Pages ← KV:
```
اسم الـ namespace: IPTV_STORE
```
انسخ الـ ID وضعه في `wrangler.toml`.

### 2. تغيير كلمة المرور

افتح `functions/api/login.js` وعدّل:
```js
const MASTER_PASSWORD = "كلمة_المرور_الجديدة";
```

### 3. رفع المشروع

**الطريقة الأولى - Git:**
1. ارفع المجلد على GitHub
2. في Cloudflare Pages ← Create project ← Connect to Git
3. Build command: (اتركه فارغاً)
4. Build output: `public`
5. في Environment Variables أضف الـ KV binding: `IPTV_KV`

**الطريقة الثانية - Wrangler CLI:**
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy public --project-name=iptv-admin
```

### 4. ربط الـ KV بالـ Pages Function

في Cloudflare Dashboard:
- افتح مشروعك في Pages
- Settings ← Functions ← KV namespace bindings
- Variable name: `IPTV_KV`
- اختر الـ namespace الذي أنشأته

---

## رابط البروكسي للمشغل (AppCreator)

```
https://اسم-مشروعك.pages.dev/proxy/video.m3u8?id=XXX&cat=YYY
```

---

## ملاحظات

- يتم تخزين الإعدادات في Cloudflare KV (مستمر بين الجلسات)
- كلمة المرور محفوظة في كود الـ Function (غيّرها قبل النشر)
- جلسة تسجيل الدخول تنتهي بعد 8 ساعات
