# Zapis wyników i wznawianie gry – projekt

Data: 2026-10-13. Gra: „Nić Ariadny” (`index.html`, `js/`), hostowana na GitHub Pages.

## Cel

1. Każda rozgrywka zapisuje się w bazie danych, a gracz ma historię swoich gier i rekordy.
2. Przerwaną grę (zamknięta karta, odświeżenie strony, wyjście do menu) można wznowić w tym samym miejscu.

## Ustalenia z rozmowy

- **Bez logowania.** Gracz jest rozpoznawany po urządzeniu (przeglądarce). Nic nie wpisuje.
- **Historia prywatna.** Gracz widzi tylko swoje gry. Wspólnego rankingu na razie nie ma.
- **Poddane gry też się zapisują** jako `gaveup`, ale nie liczą się do rekordów. (Przyjęte domyślnie, bez wyraźnej odpowiedzi.)

## Założenia

- Baza: **Supabase** (PostgreSQL). Gra łączy się z nią bezpośrednio z przeglądarki, bo GitHub Pages nie ma serwera.
- Tożsamość: **anonimowe logowanie Supabase** (`signInAnonymously`). Sesja zostaje w przeglądarce. Dzięki temu `auth.uid()` wskazuje gracza, a zasady RLS w bazie gwarantują, że nikt nie odczyta ani nie zmieni cudzych gier, choć klucz publiczny jest widoczny w kodzie strony.
- Wyczyszczenie danych przeglądarki = nowy anonimowy gracz. Stara historia zostaje w bazie, ale gracz nie ma już do niej dostępu.

## Model danych

Jedna tabela `public.games`. Jeden wiersz to jedna rozgrywka.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid | identyfikator gry |
| `player_id` | uuid | anonimowy gracz, domyślnie `auth.uid()` |
| `difficulty` | text | `easy` / `medium` / `hard` |
| `seed` | bigint (uint32) | ziarno dla `Maze.mulberry32`, z którego powstaje identyczny labirynt |
| `path` | text | udane ruchy: litery `U D L R` |
| `moves` | integer | zawsze równe długości `path` |
| `elapsed_ms` | integer | czas gry do tej pory |
| `hints_used` | smallint | 0–3 |
| `status` | text | `playing` / `won` / `gaveup` / `abandoned` |
| `started_at`, `updated_at`, `finished_at` | timestamptz | `finished_at` jest puste wtedy i tylko wtedy, gdy gra trwa |

Wznowienie odtwarza grę z `seed` (labirynt) i `path` (pozycja gracza i cała nić). Zegar liczy dalej od `elapsed_ms`, a liczba podpowiedzi wynika z `hints_used`.

Widok `public.my_best` (z `security_invoker`) zwraca dla każdego poziomu najlepszy czas, najmniejszą liczbę ruchów i liczbę wygranych gracza.

## Zasady pilnowane przez bazę

- **Najwyżej jedna gra `playing` na gracza** (unikalny indeks częściowy). Wstawienie nowej gry zmienia poprzednią grę w toku na `abandoned`.
- **Nowa gra zawsze startuje jako `playing`.** Status i daty ustawia wyzwalacz, nie klient.
- **W trakcie gry `path` można tylko wydłużać**, a `elapsed_ms` i `hints_used` nie mogą maleć. Gracz, poziom, ziarno i data startu są niezmienne.
- **Gry zakończonej (`won`, `gaveup`, `abandoned`) nie można zmienić.** `finished_at` ustawia wyzwalacz.
- **RLS:** rola `authenticated` (obejmuje anonimowych graczy) ma `select`, `insert` i `update` tylko na własnych wierszach. Usuwania nie ma. Rola `anon` (bez sesji) nie ma dostępu.

**Znane ograniczenie:** baza nie sprawdza, czy `path` naprawdę prowadzi do mety, bo nie generuje labiryntu. Ponieważ historia jest prywatna, fałszywy wynik szkodzi tylko samemu graczowi. Przy wspólnym rankingu trzeba będzie dodać weryfikację, np. funkcję Edge, która odtworzy labirynt z `seed`.

## Zachowanie gry (następny etap, osobny plan)

- Przy starcie gra loguje gracza anonimowo, jeśli nie ma sesji.
- Nowa gra losuje `seed`, tworzy labirynt przez `Maze.mulberry32(seed)` i wstawia wiersz.
- Postęp zapisuje się co kilka sekund gry, przy ukryciu lub zamknięciu karty (`visibilitychange`, `pagehide`) i na koniec gry (`won` / `gaveup`).
- Menu pokazuje przycisk „Wznów” z poziomem i czasem, jeśli istnieje gra `playing`. Rekordy pochodzą z `my_best`.
- **Bez internetu lub bez bazy** gra działa jak dziś: rekord zapisuje się lokalnie w `localStorage`, a wznawianie jest niedostępne. Ustawienie dźwięku zostaje w `localStorage`.

## Pliki

- `supabase/migrations/20261013120000_games.sql` – tabela, wyzwalacze, RLS, widok.
- `supabase/README.md` – jak założyć projekt i uruchomić skrypt.

## Testy

Skrypt SQL sprawdzono na PostgreSQL (PGlite) z atrapą `auth.users`, `auth.uid()` oraz ról `anon` i `authenticated`. Przeszło 21 sprawdzeń: automatyczny `player_id`, wymuszony status startowy, zapis postępu, odrzucanie niespójnych ruchów, cofania czasu, złych liter i zmiany ziarna, izolacja graczy (odczyt, zmiana, podszywanie się), brak usuwania, porzucanie poprzedniej gry, jedna gra w toku, zamrożenie wyniku, widok rekordów i brak dostępu bez sesji.
