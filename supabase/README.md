# Baza danych gry (Supabase)

Instrukcja jednorazowej konfiguracji. Zajmuje ok. 5 minut.

## 1. Utwórz projekt

1. Zaloguj się na https://supabase.com/dashboard i kliknij **New project**.
2. Nazwa: np. `nic-ariadny`. Region: **Central EU (Frankfurt)** (najbliżej Polski). Plan: **Free**.
3. Ustaw hasło do bazy i zapisz je w bezpiecznym miejscu. Gra go nie potrzebuje.
4. Poczekaj ok. 2 minuty, aż projekt się utworzy.

## 2. Włącz anonimowe logowanie

1. W menu po lewej: **Authentication → Sign In / Providers**.
2. Włącz **Allow anonymous sign-ins** i zapisz.
3. Zalecane: w **Authentication → Attack Protection** włącz CAPTCHA, żeby boty nie tworzyły tysięcy anonimowych kont.

## 3. Utwórz tabelę

1. W menu po lewej: **SQL Editor → New query**.
2. Wklej całą zawartość pliku `migrations/20261013120000_games.sql` i kliknij **Run**.
3. Powinien pojawić się komunikat **Success. No rows returned**.
4. Sprawdź w **Table Editor**, że jest tabela `games` z ikoną kłódki (RLS włączone).

## 4. Przekaż dane do gry

W **Project Settings → API** (lub **Data API**) skopiuj:

- **Project URL**, np. `https://abcdefgh.supabase.co`
- **anon / publishable key**, czyli klucz publiczny

Oba są bezpieczne do umieszczenia w kodzie strony, bo dostępu pilnują zasady RLS z kroku 3.
**Nigdy nie wklejaj do gry klucza `service_role` / secret.** Omija on wszystkie zabezpieczenia.

## 5. Konta graczy (migracja 2)

Wszystko poniżej robi narzędzie `tools/supabase-admin.mjs` (zob. `docs/superpowers/plans/2026-10-13-konta-uzytkownikow.md`, Zadanie 5).
Ręcznie w panelu:

1. **SQL Editor** – uruchom `migrations/20261013150000_profiles.sql`.
2. **Authentication → Sign In / Providers** – wyłącz **Allow anonymous sign-ins**, wyłącz **Confirm email**, minimalna długość hasła 8.
3. **Authentication → URL Configuration** – Site URL i Redirect URLs: `https://justynaanalityk.github.io/Gra-maze/`.
4. **Edge Functions** – wdróż `functions/login/index.ts` jako funkcję `login` z wyłączonym **Verify JWT**.

Konta testowe z narzędzi mają adresy `e2e.…@mailinator.com` (Supabase odrzuca `@example.com`). Usuwanie:
`node tools/supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@mailinator.com'" logout`
