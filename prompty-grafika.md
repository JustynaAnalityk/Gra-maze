# Nić Ariadny – prompty do generowania grafiki

Prompty do generatora obrazów (Midjourney, DALL·E, Firefly, Stable Diffusion i podobne).
Są po angielsku, bo generatory lepiej je rozumieją. Kolory pasują do gry:

| Rola | Jasny motyw | Ciemny motyw |
|---|---|---|
| Papier / tło | `#efe9dc` (kremowy) | `#0f1422` (nocny granat) |
| Atrament, ściany | `#1f2a44` (granat) | `#d3dcf0` (jasny błękit) |
| Nić | `#b3261e` (czerwień) | `#e5393b` (czerwień) |
| Brama, meta | `#dc9c00` (złoto) | `#f6c445` (złoto) |

Środek obrazu ma zostać spokojny i pusty. Na nim leżą menu, tytuł i plansza gry.

---

## 1. Tło menu – jasny motyw (16:9)

```
Elegant background for a minimalist puzzle game menu, 16:9, fine-art illustration in the style of an old hand-drawn puzzle notebook. Theme: the myth of Ariadne's thread and the Cretan labyrinth, refined adult aesthetic. Composition: the central 70% of the frame is calm, almost empty warm cream paper (#efe9dc) with very subtle paper grain and faint dotted grid, low contrast - reserved for title text, menu buttons and the game board. All detail pushed to the edges: fragments of a labyrinth drawn in deep navy ink (#1f2a44) fading in from the left and right edges, a thin Greek meander border running along the top and bottom edges, a single fine crimson-red thread (#b3261e) entering from the bottom-left corner and loosely winding along the edge, a small half-unwound ball of red yarn resting in the bottom-left corner, a tiny golden (#dc9c00) Greek temple gate hinted in the bottom-right corner with a soft warm glow. Lighting: soft, even daylight on paper, gentle vignette darkening the corners. Palette: cream paper, navy ink, crimson thread, muted gold. No text, no letters, no logos, no symbols in the center, no people, no faces, no Minotaur. Detailed edges, soft and clean center, crisp ink linework, subtle watercolor texture, 4K.
```

## 2. Tło menu – ciemny motyw (16:9)

```
Elegant dark background for a minimalist puzzle game menu, 16:9, fine-art illustration, night version of an old puzzle notebook. Theme: the myth of Ariadne's thread and the Cretan labyrinth, mysterious refined adult atmosphere. Composition: the central 70% of the frame is a calm, almost empty, very dark midnight-navy surface (#0f1422) with smooth low-contrast texture and barely visible dotted grid - reserved for title text, menu buttons and the game board. All detail pushed to the edges: fragments of a labyrinth drawn in pale silvery-blue lines (#d3dcf0) fading in from the left and right edges, a faint Greek meander border along the top and bottom edges, a single fine glowing crimson thread (#e5393b) entering from the bottom-left corner and winding along the edge, a small ball of red yarn in the bottom-left corner, a tiny golden (#f6c445) Greek temple gate in the bottom-right corner emitting a soft warm glow. Lighting: low-key, moonlit, deep shadows, warm gold and red accents only at the edges. Palette: midnight navy, pale silver-blue, crimson, warm gold. No text, no letters, no logos, no symbols in the center, no people, no faces, no Minotaur. Highly detailed edges, soft and clean center, crisp linework, 4K.
```

## 3. Tło na telefon – jasny motyw (9:16)

```
Elegant vertical background for a mobile puzzle game, 9:16, fine-art illustration in the style of an old hand-drawn puzzle notebook. Theme: Ariadne's thread and the Cretan labyrinth. Composition: the central 75% of the frame is calm, almost empty warm cream paper (#efe9dc) with subtle grain - reserved for the title, buttons and a square game board. Detail only at the top and bottom edges: a thin Greek meander band along the top edge, labyrinth fragments in navy ink (#1f2a44) fading in from the bottom corners, a fine crimson thread (#b3261e) rising from a small ball of red yarn in the bottom-left corner, a tiny golden (#dc9c00) temple gate with a soft glow in the bottom-right corner. Lighting: soft daylight, gentle vignette. Palette: cream, navy ink, crimson, muted gold. No text, no letters, no logos, nothing in the center, no people, no faces. Detailed edges, clean center, crisp ink lines, 4K.
```

## 4. Okładka gry / miniatura do udostępniania (1200×630, ok. 1.9:1)

```
Cover illustration for a puzzle game called Ariadne's Thread, wide 1.9:1 format, fine-art illustration in the style of an elegant puzzle notebook. Theme: a top-down view of a perfect square labyrinth drawn in deep navy ink (#1f2a44) on warm cream paper (#efe9dc), seen slightly in perspective as if lying on a desk. Composition: the labyrinth fills the right half of the frame; a single crimson-red thread (#b3261e) unwinds from a ball of red yarn at the labyrinth entrance in the top-left corner and winds through the corridors, with one small loop where it doubled back from a dead end, ending near a small glowing golden (#dc9c00) Greek temple gate at the exit in the bottom-right corner. The left third of the frame is calm empty cream paper with a thin Greek meander border at the top - reserved for the game title. Lighting: soft warm side light, gentle shadows of the thread on the paper, shallow depth of field. Palette: cream paper, navy ink, crimson thread, muted gold. No text, no letters, no logos, no people, no faces, no Minotaur. Crisp linework, tactile paper and yarn texture, 4K.
```

---

## Wskazówki

- **Tekst w obrazie:** generatory często dorysowują litery mimo zakazu. W Midjourney dopisz na końcu `--no text, letters, watermark`, a w Stable Diffusion wpisz to samo w pole *negative prompt*.
- **Proporcje w Midjourney:** dopisz `--ar 16:9`, `--ar 9:16` albo `--ar 1.91:1`.
- **Czytelność:** jeśli środek obrazu wychodzi zbyt „zajęty”, dopisz `extremely minimal center, large negative space`.
- **Podpięcie w grze:** gotowe tło możesz zapisać np. jako `img/tlo-jasne.jpg` i podać w `style.css` w regule `body` zamiast obecnego ziarna papieru.
