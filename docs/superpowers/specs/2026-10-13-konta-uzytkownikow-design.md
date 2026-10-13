# Konta użytkowników, zapis wyników i wznawianie gry – projekt

Data: 2026-10-13. Gra: „Nić Ariadny” (statyczne pliki na GitHub Pages: `index.html`, `style.css`, `js/`).
Baza: Supabase, projekt `tiyvaauexqvlgpyewirt` (`https://tiyvaauexqvlgpyewirt.supabase.co`).

Ten projekt **zastępuje założenie o anonimowych graczach** z `2026-10-13-zapis-i-wznawianie-design.md`.
Model rozgrywki z tamtego projektu (tabela `games`, wyzwalacze, widok `my_best`) zostaje bez zmian i jest już wdrożony.

## Cel

Gracz zakłada konto (login i hasło) i ma w bazie profil. Dzięki temu na każdym urządzeniu zachowuje:
- stan przerwanej gry, którą można wznowić;
- wyniki: historię gier, rekordy i statystyki.

## Ustalenia z rozmowy

| Pytanie | Decyzja |
|---|---|
| Czym jest login | **E-mail lub nazwa użytkownika.** Rejestracja wymaga obu, a logowanie przyjmuje dowolne z nich. |
| Gra bez konta | **Nie.** Logowanie jest obowiązkowe przed menu. |
| Profil | **Pełny ekran „Mój profil”:** dane konta, statystyki, rekordy, historia, dźwięk, zmiana hasła, wylogowanie. |
| Połączenie z Supabase | Biblioteka `supabase-js` z CDN, w ustalonej wersji, bez kroku budowania. |
| Logowanie nazwą | **Edge Function `login`.** Adresy e-mail nie trafiają do przeglądarki. |

Przyjęte domyślnie i zaakceptowane w projekcie:
- potwierdzanie maila przy rejestracji jest wyłączone;
- hasło ma minimum 8 znaków;
- przy rejestracji jest pole „Mam ukończone 18 lat”;
- anonimowe logowanie jest wyłączone.

## Architektura

```
przeglądarka (GitHub Pages)                      Supabase
┌───────────────────────────────┐   HTTPS   ┌───────────────────────────────┐
│ index.html                    │──────────▶│ Auth (e-mail + hasło)         │
│  supabase-js (CDN)            │           │ PostgREST: profiles, games,   │
│  js/supabase-config.js        │           │   my_best, my_stats, RPC      │
│  js/api.js   ◀── jedyne miejsce rozmowy z Supabase                      │
│  js/auth-ui.js, js/profile.js │──────────▶│ Edge Function: login          │
│  js/main.js, js/game.js, ...  │           │   (nazwa → e-mail → sesja)    │
└───────────────────────────────┘           └───────────────────────────────┘
```

- Gra pozostaje zwykłymi skryptami bez modułów ES i bez bundlera. Dalej uruchamia się dwuklikiem, wymaga tylko internetu.
- `js/api.js` udostępnia obiekt `Api`. Reszta kodu nie wywołuje Supabase bezpośrednio. Funkcje:
  - konto: `signUp`, `signIn`, `signOut`, `resetPassword`, `updatePassword`, `currentUser`, `onAuthChange`;
  - profil: `usernameAvailable`, `getProfile`, `setMuted`;
  - gry: `startGame`, `saveGame`, `finishGame`, `getPlayingGame`, `getBest`, `getStats`, `getHistory`.
- `js/supabase-config.js` zawiera tylko adres projektu i **klucz publiczny** (`sb_publishable_…`). Klucza `service_role` / secret nigdy nie ma w kodzie strony.

## Baza danych (nowy skrypt `supabase/migrations/20261013150000_profiles.sql`)

### Tabela `public.profiles`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK → `auth.users(id)` on delete cascade | konto |
| `username` | text not null | `^[A-Za-z0-9_]{3,20}$`, unikalna bez względu na wielkość liter (unikalny indeks na `lower(username)`) |
| `muted` | boolean not null default false | wyciszenie dźwięku |
| `created_at` | timestamptz not null default now() | data założenia |

- **Profil tworzy wyzwalacz** `after insert on auth.users` (`security definer`) z `raw_user_meta_data->>'username'`, które klient przekazuje w `signUp({ options: { data: { username } } })`. Zła lub zajęta nazwa przerywa rejestrację, więc nie powstaje konto bez profilu.
- **RLS:** użytkownik czyta tylko swój profil i zmienia w nim tylko `muted` (grant `update (muted)`). Nie może tworzyć ani usuwać profili.

### Funkcja `public.username_available(name text) returns boolean`
`security definer`, dostępna dla `anon` i `authenticated`. Zwraca tylko tak lub nie. Służy do podpowiedzi w formularzu rejestracji.

### Tabela `games`: zaostrzenie RLS
Polityki `select`, `insert` i `update` dodatkowo wymagają `coalesce((select auth.jwt()->>'is_anonymous')::boolean, false) = false`. Do gier mają dostęp wyłącznie prawdziwe konta.

### Widok `public.my_stats` (`security_invoker`)
Jeden wiersz z liczbą gier: rozegranych (bez `playing`), wygranych, poddanych i porzuconych, oraz łączny czas gry (`sum(elapsed_ms)`).

Historia to `games` bez `playing`, posortowane po `started_at desc`, `limit 10`. Rekordy są w istniejącym `my_best`.

## Edge Function `login` (`supabase/functions/login/index.ts`)

- `POST { username, password }` → `200 { access_token, refresh_token }` albo `401 { error: "invalid_credentials" }`.
- Kroki:
  1. Klientem z kluczem `service_role` (zmienna środowiskowa funkcji) znajduje `profiles.id` po `lower(username)`.
  2. Pobiera e-mail przez `auth.admin.getUserById`.
  3. Klientem z kluczem publicznym wywołuje `signInWithPassword`.
- Ta sama odpowiedź dla nieznanej nazwy i złego hasła, żeby nie dało się sprawdzić, czy konto istnieje.
- CORS: `*`, bo gra działa z GitHub Pages i z `file://`. Weryfikacja JWT wyłączona, bo wywołuje ją niezalogowany gracz.
- Klient po sukcesie wywołuje `supabase.auth.setSession(...)`.
- **Znane ograniczenie:** limity prób logowania Supabase liczą się dla adresu IP funkcji, a nie gracza. Ochrona przed zgadywaniem haseł przez tę funkcję jest więc słabsza niż przy logowaniu e-mailem. Przy większej liczbie graczy trzeba dodać własny licznik prób albo CAPTCHA.

## Ustawienia projektu Supabase (w panelu)

- **Authentication → Sign In / Providers:**
  - anonimowe logowanie: wyłączone;
  - e-mail: włączony;
  - **Confirm email: wyłączone**;
  - minimalna długość hasła: 8.
- **Authentication → URL Configuration:**
  - Site URL: `https://justynaanalityk.github.io/Gra-maze/`;
  - Redirect URLs: ten sam adres (powrót z maila resetu hasła).
- **Porządki:** usunięcie dotychczasowych anonimowych kont testowych i ich gier (`delete from auth.users where is_anonymous`).

## Ekrany i działanie

### Ekran konta (przed menu, w stylu gry)
- **Zaloguj:** „E-mail lub nazwa użytkownika” i hasło. Jeśli wartość zawiera `@`, gra używa `signInWithPassword`, a w przeciwnym razie funkcji `login`.
- **Załóż konto:**
  - nazwa, z podpowiedzią „wolna / zajęta” (opóźnienie ok. 400 ms po wpisaniu);
  - e-mail, hasło, powtórzenie hasła;
  - pole „Mam ukończone 18 lat”, wymagane;
  - formularz sprawdza dane, zanim cokolwiek wyśle.
- **Nie pamiętasz hasła?** Gra wywołuje `resetPasswordForEmail` z `redirectTo` = adres gry. Po powrocie z linku (zdarzenie `PASSWORD_RECOVERY`) wyświetla formularz „Ustaw nowe hasło”.
- **Sesja zapamiętana** przez `supabase-js` w `localStorage`. Przy następnym otwarciu gracz trafia od razu do menu.

### Menu
- **Pasek u góry:** „Zalogowano jako *nazwa*”, a obok przyciski **Mój profil** i **Wyloguj**.
- **„Wznów: Poziom · czas · N ruchów”:** przycisk nad poziomami, jeśli istnieje gra `playing`.
- **Rekordy przy poziomach** z `my_best`.

### Gra
- **Nowa gra:** `seed = losowa liczba uint32`, labirynt z `Maze.mulberry32(seed)`, a w bazie wstawiany jest wiersz. Baza sama porzuca poprzednią grę w toku.
- **`Game` zapisuje ścieżkę** jako litery `U D L R` przy każdym udanym ruchu.
- **Zapis postępu:**
  - ok. 3 s po ostatnim ruchu (debounce) i po podpowiedzi;
  - przy `visibilitychange` (ukrycie karty) i `pagehide` (wysyłka z `keepalive`);
  - natychmiast przy wygranej i poddaniu się (`finishGame`).
- **Wyjście do menu albo zamknięcie strony** zostawia grę jako `playing`, do wznowienia. Zegar nie biegnie poza grą.
- **„Nowy labirynt” (R) albo wybór poziomu** zaczyna nową grę, a poprzednia zostaje porzucona.
- **Wznowienie:**
  - `Game.restore({ difficulty, seed, path, elapsed_ms, hints_used })` odtwarza labirynt z ziarna;
  - powtarza ruchy ze ścieżki, co daje pozycję, nić i liczbę ruchów;
  - ustawia czas (`startTime = now − elapsed_ms`) i liczbę pozostałych podpowiedzi.
- **Ekran wygranej** pokazuje rekord z bazy po zapisie wyniku.
- **Dźwięk:** przy logowaniu ustawienie pochodzi z `profiles.muted`, a przełącznik zapisuje je w profilu.

### Mój profil
- nazwa, e-mail i data założenia konta;
- statystyki z `my_stats`, rekordy z `my_best`, historia 10 ostatnich gier;
- przełącznik dźwięku;
- zmiana hasła (nowe hasło i powtórzenie, przez `updateUser`) oraz wylogowanie.

### Błędy
- **Brak połączenia przy starcie:** komunikat „Brak połączenia z serwerem” i przycisk „Spróbuj ponownie”.
- **Nieudany zapis w grze:** gra trwa dalej, w pasku pojawia się znacznik „niezapisane”, a zapis ponawia się co 5 s i przy kolejnym ruchu.
- **Sesja wygasła lub odrzucona:** powrót do ekranu logowania. Gra w toku zostaje w bazie z ostatnim zapisanym stanem.
- **Komunikaty Supabase** tłumaczone na polski, m.in.:
  - złe dane logowania;
  - zajęta nazwa;
  - zajęty e-mail;
  - za krótkie hasło;
  - zbyt wiele prób.

## Zmiany w istniejącym kodzie

- **`js/game.js`:** konstruktor przyjmuje `seed` (lub losuje), dodane pola `seed` i `path`, oraz `Game.restore`.
- **`js/main.js`:**
  - ekrany konta i profilu;
  - przycisk „Wznów”;
  - autozapis;
  - rekordy i dźwięk z bazy.
- **`js/storage.js`:** usunięty. Rekordy i dźwięk są w bazie, a sesję trzyma `supabase-js`.
- **`index.html`:**
  - sekcje ekranu konta i profilu;
  - pasek konta w menu;
  - `<script>` z `supabase-js` (ustalona wersja z jsDelivr/cdnjs) i nowymi plikami.
- **`style.css`:** formularze i profil w obecnym stylu, oba motywy, układ na telefon.
- **`js/preview.js`:** bez zmian, bo podgląd w menu nie zapisuje się w bazie.

## Testy

1. **`tests.html`** (jednostkowe, bez sieci):
   - ten sam `seed` daje ten sam labirynt;
   - `path` rejestruje tylko udane ruchy;
   - `Game.restore` odtwarza pozycję, nić, ruchy, czas i podpowiedzi;
   - wznowienie gry wygranej lub poddanej nie jest możliwe.
2. **SQL na PGlite** (atrapa `auth`):
   - profil tworzony przy rejestracji;
   - zła lub zajęta nazwa (także inną wielkością liter) przerywa rejestrację;
   - `username_available`;
   - RLS profili (odczyt i zmiana tylko `muted`);
   - konta anonimowe bez dostępu do `games`;
   - `my_stats`.
3. **Na żywo, w przeglądarce (Playwright, konto testowe):**
   - rejestracja;
   - wylogowanie i logowanie nazwą oraz e-mailem;
   - złe hasło daje komunikat;
   - gra kilka ruchów, odświeżenie strony i „Wznów” odtwarzają tę samą pozycję, nić i czas;
   - wygrana, a potem rekord w menu i w profilu, historia i statystyki;
   - zmiana hasła i logowanie nowym hasłem;
   - zrzuty ekranu w obu motywach i na telefonie.
4. **Na koniec:** usunięcie kont testowych.

## Poza zakresem

- wspólny ranking graczy;
- logowanie przez Google lub GitHub;
- usuwanie konta przez gracza;
- zmiana nazwy użytkownika lub e-maila;
- weryfikacja po stronie serwera, że ścieżka naprawdę prowadzi do mety.
