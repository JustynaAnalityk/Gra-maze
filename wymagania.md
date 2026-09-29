# Labirynt – wymagania

Jak wypełniać:
- Zaznacz wybór, zamieniając `- [ ]` na `- [x]` (możesz zaznaczyć kilka, chyba że pytanie mówi „jedno”).
- Dopisz swoje słowa po **Odpowiedź:**.
- Pytanie możesz zostawić puste. Wtedy przyjmiemy wartość z „Jeśli nie wiesz”.

> Wypełnione przez Claude na prośbę użytkownika („wybierz za mnie wszystko”). Każdą odpowiedź można zmienić.

---

## 0. Opis własny

**0.1** Opisz swoimi słowami, jak ma wyglądać i działać gra. Co widzi gracz po uruchomieniu, co robi i jak kończy się rozgrywka?

**Odpowiedź:** Po otwarciu `index.html` widać menu z tytułem „Labirynt”, krótką instrukcją i trzema przyciskami trudności: Łatwy, Średni, Trudny. Po wyborze pojawia się losowo wygenerowany labirynt widziany z góry. Gracz (kółko) startuje w lewym górnym rogu, a meta (gwiazdka) jest w prawym dolnym. Gracz porusza się strzałkami, WASD albo przesuwając palcem po ekranie. Za nim zostaje ślad przebytej drogi. Na górze widać czas i liczbę ruchów. Gracz może 3 razy wziąć podpowiedź albo się poddać i zobaczyć całą drogę. Po dojściu do mety pojawia się ekran wygranej z czasem, liczbą ruchów i najlepszym wynikiem oraz przyciskami „Następny labirynt” i „Menu”.

---

## 1. Cel i odbiorca

**1.1** Dla kogo jest gra?
- [ ] dzieci (ok. ___ lat)
- [x] dorośli / wszyscy
- [ ] dla mnie – nauka programowania w JS
- [ ] inne: ___

**1.2** Gdzie gra będzie uruchamiana?
- [x] lokalnie – dwuklik na plik `index.html`
- [ ] w internecie (np. GitHub Pages)
- [x] na komputerze
- [x] na telefonie / tablecie

**1.3** Po czym poznasz, że gra jest gotowa i udana?

**Odpowiedź:** Gra uruchamia się dwuklikiem, bez instalowania czegokolwiek. Każdy labirynt da się przejść na każdym poziomie trudności. Gra działa na komputerze (klawiatura) i na telefonie (swipe). Najlepszy czas zostaje zapamiętany po zamknięciu przeglądarki. Testy generatora przechodzą.

---

## 2. Plansza

**2.1** Widok (wybierz jedno):
- [x] z góry, 2D (klasyczna siatka)
- [ ] pseudo-3D, z perspektywy pierwszej osoby
- [ ] inne: ___

**2.2** Skąd biorą się labirynty?
- [x] generowane losowo przy każdej grze
- [ ] ręcznie zaprojektowane poziomy
- [ ] mieszane

**2.3** Jaki rozmiar planszy (liczba pól)?
- [ ] mały
- [ ] średni
- [ ] duży
- [x] zależny od poziomu trudności – Łatwy 10×10, Średni 18×18, Trudny 28×28

**2.4** Jak wygląda labirynt?
- [x] „idealny” – dokładnie jedna droga między dwoma dowolnymi punktami (algorytm DFS z cofaniem)
- [ ] z pętlami

**2.5** Gdzie są start i meta?
- [x] zawsze w przeciwległych rogach (start: lewy górny, meta: prawy dolny)
- [ ] losowo
- [ ] inne: ___

---

## 3. Gracz i sterowanie

**3.1** Sterowanie na komputerze:
- [x] strzałki
- [x] WASD
- [ ] mysz

**3.2** Sterowanie na telefonie:
- [x] przesunięcie palcem (swipe)
- [ ] przyciski strzałek na ekranie
- [ ] nie dotyczy

**3.3** Jak porusza się gracz?
- [x] skokowo, o jedno pole na naciśnięcie (trzymanie klawisza powtarza ruch)
- [ ] płynnie, bez siatki

**3.4** Jak wygląda postać gracza?

**Odpowiedź:** Kolorowe kółko, które płynnie (ok. 80 ms) przesuwa się na nowe pole. Meta to złota gwiazdka.

**3.5** Czy za graczem ma zostawać ślad przebytej drogi?
- [x] tak (półprzezroczysta linia)
- [ ] nie

---

## 4. Zasady i cel gry

**4.1** Cel gry:
- [x] dojść do mety
- [ ] dojść do mety po zebraniu wszystkich przedmiotów
- [ ] inne: ___

**4.2** Czy można przegrać?
- [x] nie – gra na spokojnie
- [ ] tak, gdy skończy się czas
- [ ] tak, gdy złapie mnie przeciwnik / trafię w pułapkę
- [ ] tak, gdy skończy się limit ruchów

**4.3** Co jest mierzone?
- [x] czas (liczony od pierwszego ruchu)
- [x] liczba ruchów (uderzenie w ścianę nie liczy się jako ruch)
- [ ] nic

---

## 5. Elementy dodatkowe

W pierwszej wersji:

- [ ] klucze i zamknięte drzwi
- [ ] monety / przedmioty do zebrania
- [ ] przeciwnicy, którzy się poruszają
- [ ] pułapki
- [ ] mgła – gracz widzi tylko pola wokół siebie
- [ ] teleporty
- [x] podpowiedź: pokaż fragment drogi
- [x] przycisk „pokaż rozwiązanie” (poddaję się)
- [ ] mini-mapa
- [ ] inne: ___

**5.1** Jak to ma działać:

**Odpowiedź:**
- **Podpowiedź** (klawisz `H` lub przycisk): przez 2 sekundy podświetla najbliższe 5 pól właściwej drogi od aktualnej pozycji gracza. Są 3 podpowiedzi na labirynt. Użycie podpowiedzi nie blokuje zapisu wyniku.
- **Poddaję się**: rysuje całą drogę do mety i kończy grę bez zapisu wyniku.

---

## 6. Poziomy i progresja

**6.1** Jak zorganizowana jest gra?
- [ ] jeden labirynt, a potem „zagraj ponownie”
- [ ] kolejne poziomy, coraz trudniejsze
- [x] gracz wybiera poziom trudności (łatwy / średni / trudny); po wygranej „Następny labirynt” losuje nowy na tej samej trudności

**6.2** Ile poziomów?
- [x] bez końca – każdy labirynt jest nowy i losowy

**6.3** Co zmienia się z trudnością?

**Odpowiedź:** Tylko rozmiar planszy (10×10 / 18×18 / 28×28).

**6.4** Czy ten sam labirynt da się odtworzyć (seed)?
- [ ] tak
- [x] nie, niepotrzebne (pojawi się w „później”)

---

## 7. Punktacja i zapis

**7.1** Czy gra ma zapamiętywać najlepsze wyniki (w przeglądarce)?
- [x] tak – najlepszy czas dla każdego poziomu trudności (localStorage)
- [ ] tak – tabela top 10 z imieniem gracza
- [ ] nie

**7.2** Czy gra ma zapamiętywać postęp?
- [ ] tak
- [x] nie (nie ma czego odblokowywać)

**7.3** Jak liczyć punkty?

**Odpowiedź:** Punktów nie ma. Wynikiem jest czas, a liczba ruchów jest dodatkową informacją.

---

## 8. Ekrany i interfejs

**8.1** Jakie ekrany są potrzebne?
- [x] menu startowe (tytuł, krótka instrukcja, najlepsze czasy)
- [x] wybór poziomu / trudności (w menu startowym)
- [x] ekran gry z paskiem informacji (czas, ruchy, trudność, podpowiedzi)
- [ ] pauza
- [x] ekran wygranej (czas, ruchy, „Nowy rekord!”, „Następny labirynt”, „Menu”)
- [ ] ekran przegranej
- [ ] ustawienia (wyciszenie jest przyciskiem na pasku)
- [x] instrukcja „Jak grać” (2–3 linijki w menu)

**8.2** Czy w trakcie gry ma być przycisk „Nowy labirynt / Restart”?
- [x] tak (klawisz `R` lub przycisk)
- [ ] nie

**8.3** Język interfejsu:
- [x] polski
- [ ] angielski
- [ ] oba

---

## 9. Wygląd i dźwięk

**9.1** Styl graficzny:
- [x] minimalistyczny (proste kolory i linie)
- [ ] pixel-art / retro
- [ ] neon na ciemnym tle
- [ ] bajkowy
- [ ] inne: ___

**9.2** Ulubione kolory lub motyw:

**Odpowiedź:** Spokojne kolory: ściany w ciemnym granacie, jasne tło, gracz koralowy, meta złota, ślad i podpowiedź w turkusie.

**9.3** Tryb jasny / ciemny:
- [ ] tylko jasny
- [ ] tylko ciemny
- [x] zgodnie z ustawieniem systemu (`prefers-color-scheme`)

**9.4** Dźwięk:
- [x] efekty (krok, uderzenie w ścianę, wygrana) – generowane w kodzie (Web Audio), bez plików
- [ ] muzyka w tle
- [ ] bez dźwięku
- [x] przycisk wyciszenia (stan zapamiętany)

**9.5** Animacje:
- [x] tak, proste (płynny ruch postaci, krótkie konfetti przy wygranej)
- [ ] nie

---

## 10. Technika

**10.1** Biblioteki:
- [x] czysty JavaScript, bez bibliotek
- [ ] mogą być biblioteki

**10.2** Rysowanie planszy:
- [x] `<canvas>` – skaluje się do rozmiaru ekranu i dobrze radzi sobie z 28×28 i animacjami
- [ ] elementy HTML + CSS Grid
- [ ] obojętne

**10.3** Struktura plików:
- [ ] jeden plik `index.html`
- [x] osobne pliki: `index.html`, `style.css`, `js/maze.js` (generator i szukanie drogi), `js/game.js` (stan gry), `js/render.js` (rysowanie), `js/input.js` (klawiatura i swipe), `js/audio.js`, `js/storage.js`, `js/main.js`. Zwykłe `<script>`, bez modułów ES: moduły nie działają po otwarciu pliku dwuklikiem (`file://`).

**10.4** Przeglądarki:

**Odpowiedź:** Aktualne Chrome, Edge i Firefox na komputerze oraz Chrome i Safari na telefonie.

**10.5** Testy automatyczne:
- [x] tak – plik `tests.html` otwierany w przeglądarce, bez instalacji. Sprawdza, że labirynt ma drogę do mety, każde pole jest osiągalne, liczba przejść wynosi N−1 (labirynt idealny), gracz nie przechodzi przez ściany, a wygrana wykrywa się na mecie.
- [ ] nie

**10.6** Czy kod ma mieć komentarze po polsku?
- [x] tak (krótkie, przy nieoczywistych miejscach)
- [ ] nie

---

## 11. Zakres

**11.1** MUSI być w pierwszej wersji (MVP):

**Odpowiedź:** Menu z trzema poziomami trudności, losowy idealny labirynt, ruch klawiaturą i swipe, ślad, licznik czasu i ruchów, 3 podpowiedzi, „poddaję się”, restart, ekran wygranej, najlepsze czasy w localStorage, dźwięki z wyciszeniem, jasny i ciemny motyw, `tests.html`.

**11.2** Może być później:

**Odpowiedź:** Seed (udostępnianie labiryntu), monety, klucze i drzwi, mgła, przeciwnicy, labirynty z pętlami, pauza, top 10 z imionami, publikacja na GitHub Pages.

**11.3** Czego na pewno NIE robimy:

**Odpowiedź:** Widoku 3D, trybu dla wielu graczy, serwera, kont użytkowników, frameworków i narzędzi budujących (npm, bundler).

**11.4** Termin:

**Odpowiedź:** Jedna sesja pracy.

---

## 12. Inspiracje

**12.1** Inspiracje:

**Odpowiedź:** Klasyczne labirynty z gazet i zeszytów zagadek (czytelne, cienkie ściany) oraz prostota gier przeglądarkowych typu Google Snake.

---

## 13. Coś jeszcze?

**13.1**

**Odpowiedź:** Plansza ma mieścić się w całości na ekranie bez przewijania, także na telefonie w pionie.
