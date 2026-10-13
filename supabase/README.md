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
