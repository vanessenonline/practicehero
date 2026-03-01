# PracticeHero — Known Issues & Lessons Learned

> Dit document beschrijft bugs die zijn opgetreden, waarom ze optraden, hoe ze zijn opgelost,
> en wat we volgende keer anders moeten doen. Verplicht te lezen bij het starten van een nieuwe sessie.

---

## Issue #1: Supabase signOut() hangt in de browser

### Symptomen
- Kindmodus-knop werkt niet: console logs verschijnen maar geen redirect
- Uitloggen werkt niet: console logs verschijnen maar geen redirect
- Console toont: `Acquiring an exclusive Navigator LockManager lock "lock:sb-..." timed out waiting 10000ms`

### Oorzaak
`supabase.auth.signOut()` roept intern de Browser Lock Manager API aan
(`navigator.locks.request()`). In sommige browsers (Chrome/Safari) **hangt
deze call 10 seconden** voordat hij timeout. Gedurende die 10 seconden staat
de volledige `signOut()` call geblokkeerd.

### Foutieve tussenoplossingen (die niet werkten)

**Poging 1:** `Promise.race()` met 5-seconden timeout
```typescript
// ❌ WERKT NIET — cookie worden nog steeds niet verwijderd
await Promise.race([signOut(), timeout(5000)]);
router.push('/nl/login');  // middleware redirect terug!
```
**Waarom niet:** De timeout stopt het wachten, maar de Supabase sessie-cookies
zijn NIET verwijderd. De middleware leest de cookies en stuurt de user terug.

**Poging 2:** Directe redirect zonder te wachten op signOut
```typescript
// ❌ WERKT NIET — user nog steeds ingelogd
window.location.href = '/nl/login';
```
**Waarom niet:** Middleware ziet geldige sessie in cookies → redirect terug naar dashboard.

**Poging 3:** `Promise.race()` met 3-seconden timeout + `router.push()`
```typescript
// ❌ WERKT SOMS NIET — zelfde cookie-probleem als poging 1
await Promise.race([signOut(), timeout(3000)]);
router.push('/nl/login');
```
**Waarom niet:** Als signOut() timeout na 3s, zijn cookies NIET verwijderd.
Soms werkt het wel (als signOut toevallig snel genoeg is), maar niet betrouwbaar.

### Werkende oplossing (Commit b6d74fd)

**Server-side logout route:** `src/app/api/auth/logout/route.ts`

```typescript
// route.ts
export async function GET(request: NextRequest) {
  const redirect = searchParams.get("redirect") ?? "/nl/login";

  // 1. Server-side signOut (geen Lock Manager issue op server!)
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch { /* best-effort */ }

  // 2. Verwijder ALLE sb-* cookies expliciet
  const response = NextResponse.redirect(redirectUrl);
  request.cookies.getAll()
    .filter(c => c.name.startsWith("sb-"))
    .forEach(cookie => response.cookies.delete(cookie.name));

  return response;
}
```

```typescript
// In ParentNav.tsx / ChildNav.tsx:
// ✅ CORRECT — volledige page load, server verwijdert cookies
window.location.href = `/api/auth/logout?redirect=/${locale}/login`;

// ✅ CORRECT — voor child mode (encodeURIComponent is verplicht!)
window.location.href = `/api/auth/logout?redirect=${encodeURIComponent(`/${locale}/login?tab=child`)}`;
```

### Waarom de server-side aanpak werkt
1. Server-side Supabase client gebruikt GEEN Browser Lock Manager → geen timeout
2. Server kan cookies direct in de HTTP response-headers verwijderen
3. `window.location.href` forceert een volledige page load (inclusief middleware)
4. Middleware ziet geen `sb-*` cookies → user is uitgelogd → redirect naar login is toegestaan

### Regel voor de toekomst
> **NOOIT** `supabase.auth.signOut()` client-side aanroepen als vervolgens
> navigatie nodig is. **ALTIJD** `/api/auth/logout?redirect=...` gebruiken.

---

## Issue #2: Next.js Middleware redirect loop bij onvolledige logout

### Symptomen
- Na klikken op uitlog/kindmodus-knop: pagina laadt even opnieuw en je bent nog steeds ingelogd
- URL verandert kort naar `/login` en springt dan terug naar `/dashboard`

### Oorzaak
De Next.js middleware (`middleware.ts`) draait bij elke page request en controleert
de Supabase sessie via **HTTP-only cookies**. Als signOut niet compleet is
(cookies niet verwijderd), ziet de middleware een geldige sessie en redirect
authenticated users ALTIJD weg van publieke routes (login, register).

```typescript
// middleware.ts — dit veroorzaakt de loop:
if (user && isPublicPath) {
  // Redirect ingelogde user TERUG naar hun dashboard
  return NextResponse.redirect(dashboardUrl);
}
```

### Oplossing
Zie Issue #1 — server-side logout verwijdert cookies zodat middleware `user = null` ziet.

### Regel voor de toekomst
> Elke navigatie na een logout VEREIST dat cookies eerst zijn verwijderd.
> `router.push()` en `window.location.href` zijn BEIDE onderhevig aan middleware.
> Gebruik altijd de server-side logout route als tussenstap.

---

## Issue #3: Practice tijd reset naar 15 minuten

### Symptomen
- Kind oefent 2m20s (afgerond naar 2m), voltooit de sessie
- Kind gaat terug naar home en opent opnieuw het oefenscherm
- Resterende tijd toont 15m in plaats van 13m

### Oorzaak
`cumulativePriorSeconds` state in `PracticeSession.tsx` werd altijd op `0`
geïnitialiseerd bij component mount. Het component "vergat" eerder geoefende
tijd zodra het opnieuw werd gemount.

```typescript
// ❌ Oud: altijd 0 bij mount
const [cumulativePriorSeconds, setCumulativePriorSeconds] = useState(0);
// useEffect: (geen initialisatie van DB)
```

### Oplossing (Commit 8d3c1df)

Nieuwe server action `getTodayPracticeSeconds()` in `practice.ts`:
```typescript
export async function getTodayPracticeSeconds(): Promise<number> {
  // Queryt alle completed practice_sessions voor vandaag
  // Summeert duration_seconds (null-safe)
  // Geeft totaal terug in seconden
}
```

Nieuwe useEffect in `PracticeSession.tsx`:
```typescript
useEffect(() => {
  const load = async () => {
    const todaySeconds = await getTodayPracticeSeconds();
    setCumulativePriorSeconds(todaySeconds);
  };
  load();
}, []); // Eenmaal bij mount
```

### Afronding-logica (by design)
- Geoefende tijd wordt afgerond naar beneden op hele minuten
- 2m20s = 2m afgerond → 15m - 2m = 13m resterend ✅
- 6m59s = 6m afgerond → 15m - 6m = 9m resterend ✅

### Regel voor de toekomst
> Elk component dat afhankelijk is van geaccumuleerde dagelijkse data
> MOET die data laden van de database op mount — nooit aannemen dat state
> wordt bijgehouden tussen page navigaties.

---

## Issue #4: "Terug naar ouder" knop niet zichtbaar

### Symptomen
- Na inloggen als kind (via normale login, niet via Kindmodus-knop) is de
  "Terug naar ouder" knop NIET zichtbaar

### Oorzaak
De knop is conditioneel: `{isChildMode && <Button>}`. `isChildMode` is `true`
alleen als `localStorage.practicehero_child_mode === "true"`. Deze flag wordt
ALLEEN gezet door de Kindmodus-knop in ParentNav.

```typescript
// ChildNav.tsx
useEffect(() => {
  const flag = localStorage.getItem("practicehero_child_mode");
  setIsChildMode(flag === "true");  // false als flag niet gezet is
}, []);
```

### Verwacht gedrag (by design)
Dit is CORRECT gedrag. De knop hoort ALLEEN zichtbaar te zijn als de parent
expliciet de Kindmodus heeft geactiveerd. Als het kind direct inlogt (niet
via de Kindmodus-flow), is de ouder-terugknop niet van toepassing.

### Flow die werkt
```
Parent klikt "👶 Kindmodus"
→ localStorage.practicehero_child_mode = "true"
→ /api/auth/logout?redirect=.../login?tab=child
→ Login pagina (child tab)
→ Kind logt in
→ ChildNav mount: localStorage flag is "true"
→ "Terug naar ouder" knop ZICHTBAAR ✅
```

### Flow zonder knop (ook correct)
```
Kind navigeert direct naar /login
→ Kind logt in
→ ChildNav mount: localStorage flag is null/afwezig
→ "Terug naar ouder" knop NIET zichtbaar ✅ (gewenst)
```

---

## Issue #5: URL encoding ontbreekt bij redirect met query params

### Symptomen
- Na Kindmodus-flow: login pagina opent maar zonder `?tab=child`
- Child login tab is NIET voorgeselecteerd

### Oorzaak
```typescript
// ❌ Fout — ?tab=child wordt als aparte query param van logout route geparsed
window.location.href = `/api/auth/logout?redirect=/${locale}/login?tab=child`;
// Browser parseert: redirect=/nl/login, tab=child (los)
// searchParams.get("redirect") geeft: /nl/login (zonder ?tab=child)
```

### Oplossing
```typescript
// ✅ Correct — encodeURIComponent escapet de ? en = tekens
window.location.href = `/api/auth/logout?redirect=${encodeURIComponent(`/${locale}/login?tab=child`)}`;
// Browser parseert: redirect=%2Fnl%2Flogin%3Ftab%3Dchild
// searchParams.get("redirect") geeft: /nl/login?tab=child ✅
```

### Regel voor de toekomst
> ALTIJD `encodeURIComponent()` gebruiken voor redirect-URLs die zelf
> query parameters bevatten. Dit geldt voor alle `?redirect=...` parameters.

---

## Chronologische Timeline van Debug-sessies

### 2026-03-01: Kindmodus debugging

| Poging | Aanpak | Resultaat |
|--------|--------|-----------|
| 1 | Console logs toegevoegd | Ontdekt: Lock Manager timeout |
| 2 | Promise.race 5s timeout | Redirect werkt niet (cookies probleem) |
| 3 | Directe window.location redirect | Werkt niet (middleware loop) |
| 4 | Promise.race 3s + router.push | Werkt soms, niet betrouwbaar |
| 5 | Server-side /api/auth/logout | ✅ Werkt altijd |

**Kerninzicht:** Client-side signOut() kan NOOIT betrouwbaar werken voor
navigatie-doeleinden. Server-side is de enige correcte aanpak.

### 2026-03-01: Practice time tracking

| Symptoom | Root cause | Fix |
|----------|------------|-----|
| Altijd 15m na teruggaan | state=0 bij mount | DB query op mount |

---

## Commits Overzicht (Chronologisch)

```
d2f91d2  Fix Supabase Lock Manager timeout (Promise.race 5s) — ONVOLLEDIG FIX
8bd56c7  Simplify logout - immediate redirect — WERKTE NIET
7bb4195  Fix logout - wait signOut with 3s timeout — ONVOLLEDIG FIX
8d3c1df  Fix practice time tracking (getTodayPracticeSeconds) — ✅ CORRECT
1fa0994  Fix 'Back to parent' button - add timeout — ONVOLLEDIG FIX
b6d74fd  Fix logout with server-side session clearing — ✅ DEFINITIEVE FIX
```

De commits `d2f91d2`, `8bd56c7`, `7bb4195`, en `1fa0994` zijn achterhaald.
De uiteindelijke correcte aanpak staat in `b6d74fd`.

---

## Checklist: Voordat je Auth aanraakt

- [ ] Gebruik je `/api/auth/logout` i.p.v. `signOut()` voor navigatie?
- [ ] Gebruik je `window.location.href` (niet `router.push`) voor de logout redirect?
- [ ] Gebruik je `encodeURIComponent()` als de redirect URL zelf query params bevat?
- [ ] Test je altijd of de pagina ECHT naar login gaat (en niet terug springt)?

---

*Laatste update: 2026-03-01*
