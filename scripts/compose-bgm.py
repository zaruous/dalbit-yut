"""Render the original Dalbit theme, 'Noeul meomun madang' (64s, 6/8).

Authoring only: Python + NumPy + ffmpeg. No samples or third-party melodies.
Run from any directory: python scripts/compose-bgm.py
"""
from pathlib import Path
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
EIGHTH = 1 / 3  # Six eighth notes per bar, dotted quarter = 60 BPM.
SECONDS = 64
mix = np.zeros((RATE * SECONDS, 2), dtype=np.float64)
rng = np.random.default_rng(20261028)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def place(signal, when, level, pan=0):
    """Wrap release tails into the opening, so the arrangement can loop."""
    start = round(when * RATE) % len(mix)
    stereo = signal[:, None] * level * np.sqrt([(1 - pan) / 2, (1 + pan) / 2])
    count = min(len(signal), len(mix) - start)
    mix[start:start + count] += stereo[:count]
    if count < len(signal):
        mix[:len(signal) - count] += stereo[count:]


def pluck(midi, when, level=0.15, pan=0, bass=False, bend=False):
    t = np.arange(round(RATE * (3.8 if bass else 3))) / RATE
    # Slightly stiff, detuned string modes with a soft wooden attack.
    f = hz(midi)
    pitch = f * (1 + (0.007 if bend else 0.002) * np.sin(2 * np.pi * 4.4 * t)
                 * np.minimum(t / 0.4, 1))
    if bend:
        pitch *= 1 - 0.025 * np.exp(-t * 13)
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    signal = np.zeros_like(t)
    for n in range(1, 15):
        decay = (2.2 if bass else 1.4) / (1 + 0.38 * (n - 1))
        weight = np.sin(np.pi * n * 0.21) / n ** 1.25
        signal += weight * np.sin(phase * n * np.sqrt(1 + 0.00004 * n * n)) * np.exp(-t / decay)
    noise = rng.normal(0, 1, len(t))
    signal += 0.04 * (noise + np.roll(noise, 1)) * np.exp(-t * 110)
    signal *= (1 - np.exp(-t * 850)) * np.minimum((t[-1] - t) / 0.08, 1)
    place(signal, when, level, pan)


def breath(midi, when, duration, level=0.023, pan=0.3):
    t = np.arange(round(RATE * duration)) / RATE
    f = hz(midi)
    phase = 2 * np.pi * f * t - 0.18 * np.cos(2 * np.pi * 4.7 * t)
    noise = rng.normal(0, 1, len(t))
    noise = np.convolve(noise, np.ones(13) / 13, mode='same')
    envelope = np.minimum(t / 0.3, 1) * np.minimum((duration - t) / 0.65, 1)
    signal = (np.sin(phase) + 0.17 * np.sin(phase * 2) + 0.06 * np.sin(phase * 3)
              + 0.12 * noise) * envelope
    place(signal, when, level, pan)


def drum(when, high=False, level=0.027):
    t = np.arange(round(RATE * 0.55)) / RATE
    f = 225 if high else 102
    body = np.sin(2 * np.pi * (f * t + 3 * (1 - np.exp(-t * 28))))
    noise = rng.normal(0, 1, len(t))
    signal = body * np.exp(-t * (24 if high else 12))
    signal += (0.32 if high else 0.09) * noise * np.exp(-t * 65)
    signal *= 1 - np.exp(-t * 1500)
    place(signal, when, level, 0.35 if high else -0.25)


# G major pentatonic: G A B D E. Four eight-bar phrases, answered gently.
# Entries are (eighth-note position, MIDI pitch); empty bars let notes breathe.
melody = [
    [(0, 67), (2, 69), (3, 71)], [(0, 74), (3, 71), (5, 69)],
    [(0, 67), (3, 64)], [(0, 62), (3, 64), (4.5, 67)],
    [(0, 69), (2, 71), (3, 74)], [(0, 76), (3, 74), (5, 71)],
    [(0, 69), (3, 67)], [(0, 67)],
    [(0, 71), (2, 74), (3, 76)], [(0, 79), (3, 76), (5, 74)],
    [(0, 71), (3, 69), (5, 67)], [(0, 69), (3, 74)],
    [(0, 76), (2, 74), (3, 71)], [(0, 69), (3, 71), (5, 69)],
    [(0, 67), (3, 64)], [(0, 67)],
    [(0, 74), (3, 76)], [(0, 79), (2, 76), (3, 74)],
    [(0, 71), (3, 74), (5, 71)], [(0, 69), (3, 67)],
    [(0, 64), (3, 67), (5, 69)], [(0, 71), (3, 74)],
    [(0, 69), (2, 71), (3, 67)], [(0, 64), (3, 62)],
    [(0, 67), (2, 69), (3, 71)], [(0, 74), (3, 71), (5, 69)],
    [(0, 67), (3, 64)], [(0, 62), (3, 64)],
    [(0, 67), (2, 69), (3, 71)], [(0, 69), (3, 67), (5, 64)],
    [(0, 62), (3, 64)], [(0, 67)],
]
roots = [43, 43, 40, 38, 45, 40, 38, 43,
         40, 40, 43, 38, 45, 38, 43, 43,
         40, 40, 43, 38, 40, 43, 38, 38,
         43, 43, 40, 38, 45, 38, 38, 43]

for bar, notes in enumerate(melody):
    start = bar * 2
    for j, (position, midi) in enumerate(notes):
        # Humanized by milliseconds, without making the six-beat pulse wander.
        when = start + position * EIGHTH + rng.uniform(0.004, 0.018)
        pluck(midi, when, (0.15 if j == 0 else 0.12) * rng.uniform(0.9, 1.08),
              -0.17, bend=bar % 4 == 3)
    pluck(roots[bar], start, 0.16, 0.12, bass=True)
    pluck(roots[bar] + 12, start + 1, 0.057, 0.23, bass=True)
    if bar % 4 != 3:
        pluck(roots[bar] + 19, start + 1.67, 0.035, 0.32)
    drum(start, level=0.026)
    drum(start + 1, high=True, level=0.018)
    if bar % 2:
        drum(start + 5 * EIGHTH, high=True, level=0.011)
    if bar in (4, 12, 20, 28):
        breath(74 if bar in (4, 28) else 76, start + 0.1, 4.6)
    if bar % 8 == 0:
        # A quiet, inharmonic bronze shimmer marks the longer phrases.
        t = np.arange(RATE * 5) / RATE
        gong = sum(np.sin(2 * np.pi * 196 * ratio * t) * np.exp(-t * decay)
                   for ratio, decay in [(1, 1.1), (1.51, 1.8), (2.09, 2.5), (2.7, 3.2)])
        place(gong * (1 - np.exp(-t * 50)), start, 0.006, -0.4)

# A small room: wrapped reflections also preserve the tail across the loop.
dry = mix.copy()
for delay, level in [(0.083, 0.11), (0.151, 0.08), (0.239, 0.055), (0.367, 0.035)]:
    mix += np.roll(dry[:, ::-1], round(delay * RATE), axis=0) * level
mix -= mix.mean(axis=0)
mix *= 0.78 / np.max(np.abs(mix))
pcm = np.round(np.clip(mix, -1, 1) * 32767).astype('<i2')
wav_path = ROOT / 'preview-build/audio/hanok-dusk.wav'
wav_path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(wav_path), 'wb') as output:
    output.setnchannels(2)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes(pcm.tobytes())
mp3_path = ROOT / 'public/audio/hanok-dusk.mp3'
mp3_path.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav_path),
                '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata',
                'title=노을 머문 마당', '-metadata', 'artist=달빛 윷마당', str(mp3_path)], check=True)
print(f'{mp3_path.relative_to(ROOT)}: {SECONDS}s, {mp3_path.stat().st_size:,} bytes')
print(f'Peak {np.max(np.abs(mix)):.3f}; RMS {np.sqrt(np.mean(mix ** 2)):.3f}; '
      f'loop boundary delta {np.max(np.abs(mix[0] - mix[-1])):.4f}')
