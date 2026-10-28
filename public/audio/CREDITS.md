# 달빛 노을 머문 툇마루

- Composition / arrangement: agy, for 달빛 윷마당 (2026-10-28).
- File: `moonlit-porch.mp3`, 80 seconds of stereo audio, 192 kb/s MP3.
- Production: sampled gayageum and Korean percussion, with SoundFont piano,
  acoustic bass, strings, and flute; sequenced and mixed offline with Python,
  NumPy, SciPy, tinysoundfont, and ffmpeg.
- The user selected this version after listening. Playback, mute/resume, and
  volume controls are checked separately from musical preference.

## Gayageum samples

“kayageum1” by **spt3125**, Freesound, **CC0 1.0 Universal**.
Source pack: https://freesound.org/people/spt3125/packs/1534/
License: https://creativecommons.org/publicdomain/zero/1.0/

Samples used: 24551, 24552, 24553, 24554, 24555, 24556, 24557, 24558,
24559, 24560, 24561, and 24562. Individual pages use the form
`https://freesound.org/people/spt3125/sounds/24557/`.
The samples were trimmed, repitched, sequenced, and mixed into the composition.

## Korean percussion samples

Janggo, buk, and jing recordings from **Dmitry Tsay**,
https://github.com/chaedmitry/korean-instruments

The recordings were sliced into hits and sequenced into the composition.
Upstream license: https://github.com/chaedmitry/korean-instruments/blob/master/LICENSE

MIT License

Copyright (c) 2020 Dmitry Tsay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Accompaniment SoundFont

**TimGM6mb**, copyright 2004 Tim Brechbill and 2010 David Bolton,
GPL version 2. Used for offline rendering; the SoundFont itself is not bundled
with the game.

- Source used by the authoring project:
  https://github.com/craffel/pretty-midi/blob/main/pretty_midi/TimGM6mb.sf2
- Copyright record:
  https://github.com/LibreScore/sf3/blob/master/TimGM6mb.copyright
- License text: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

## Authoring files

The original WAV, MIDI, samples, and rendering script are retained in the
local authoring workspace `D:/git/tmp/coworks/dalbit-yut-bgm-v2/`.
They are not required to play the game. The previous additive-synthesis demo
is available in the repository history before this replacement.
