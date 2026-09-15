"""Synthesize the promo's original 120 BPM percussion and bass track."""

from array import array
from math import exp, pi, sin, tanh
from pathlib import Path
import random
import struct
import wave

RATE = 48000
DURATION = 18
random.seed(42)
left = array('f', [0]) * (RATE * DURATION)
right = array('f', [0]) * (RATE * DURATION)


def mix(start, samples, gain=1, pan=0):
    offset = round(start * RATE)
    for i, value in enumerate(samples):
        index = offset + i
        if 0 <= index < len(left):
            left[index] += value * gain * (1 - pan * 0.5)
            right[index] += value * gain * (1 + pan * 0.5)


def kick():
    for i in range(round(RATE * 0.48)):
        t = i / RATE
        phase = 2 * pi * (47 * t + 105 * 0.023 * (1 - exp(-t / 0.023)))
        body = sin(phase) * exp(-t / 0.115) * min(1, t / 0.002)
        click = random.uniform(-1, 1) * exp(-t / 0.003) * 0.12
        yield tanh((body + click) * 1.7) * exp(-t / 0.22)


def snare():
    low = 0
    for i in range(round(RATE * 0.22)):
        t = i / RATE
        noise = random.uniform(-1, 1)
        low += 0.25 * (noise - low)
        clap = sum(exp(-(t - hit) / 0.025) for hit in (0, 0.009, 0.019) if t >= hit)
        tone = sin(2 * pi * 185 * t) * exp(-t / 0.027)
        yield ((noise - low) * (0.28 * clap + 0.45 * exp(-t / 0.065)) + tone * 0.28) * min(1, t / 0.001)


def hat(opened=False):
    low = 0
    decay = 0.07 if opened else 0.018
    for i in range(round(RATE * (0.26 if opened else 0.07))):
        t = i / RATE
        noise = random.uniform(-1, 1)
        low += 0.65 * (noise - low)
        metallic = sin(2 * pi * 7310 * t) * sin(2 * pi * 4937 * t)
        yield ((noise - low) * 0.8 + metallic * 0.12) * exp(-t / decay) * min(1, t / 0.001)


def bass(frequency, duration=0.29):
    filtered = 0
    for i in range(round(RATE * duration)):
        t = i / RATE
        saw = 2 * ((t * frequency) % 1) - 1
        filtered += 0.045 * (saw - filtered)
        envelope = min(1, t / 0.009) * exp(-t / 0.11) * min(1, (duration - t) / 0.025)
        yield (sin(2 * pi * frequency * t) * 0.68 + filtered * 0.32) * envelope


def sweep(duration):
    low = 0
    for i in range(round(RATE * duration)):
        t = i / RATE
        progress = t / duration
        noise = random.uniform(-1, 1)
        low += (0.03 + progress * 0.25) * (noise - low)
        envelope = sin(pi * progress) ** 2
        yield low * envelope


# A quarter-note kick makes every picture cut land on the same half-second grid.
for beat in range(DURATION * 2):
    time = beat * 0.5
    mix(time, kick(), gain=0.64 if beat < 4 else 0.76)
    if beat % 2:
        clap = list(snare())
        mix(time, clap, gain=0.31 if beat < 4 else 0.45)
        mix(time + 0.043, clap, gain=0.075, pan=-0.7)
        mix(time + 0.079, clap, gain=0.045, pan=0.7)
    if beat < 32:
        note = [73.416, 73.416, 65.406, 55][(beat // 4) % 4]
        mix(time + 0.25, bass(note), gain=0.29)
        if beat >= 12 and beat % 4 == 3:
            mix(time + 0.375, bass(note * 2, 0.12), gain=0.09)
    mix(time + 0.25, hat(opened=beat % 4 == 3), gain=0.25, pan=0.25)
    if 4 <= beat < 32:
        mix(time, hat(), gain=0.11, pan=-0.25)
        if beat % 4 == 3:
            mix(time + 0.375, hat(), gain=0.12, pan=-0.35)

# Short swells lead into the dive, the main montage, the collapse, and the finale.
for end, duration, gain in [(1.5, 0.4, 0.22), (3, 0.35, 0.16), (5, 0.5, 0.17), (10.5, 0.5, 0.16), (13.5, 0.6, 0.19), (16, 0.4, 0.16)]:
    mix(end - duration, sweep(duration), gain=gain, pan=-0.1)
    mix(end, hat(opened=True), gain=0.24, pan=-0.15)

mix(16, bass(36.708, 0.7), gain=0.35)

# Soft saturation binds the percussion before peak normalization and the closing fade.
peak = 0
for channel in (left, right):
    for i, sample in enumerate(channel):
        sample = tanh(sample * 1.15)
        channel[i] = sample
        peak = max(peak, abs(sample))

pcm = bytearray()
for i, (l, r) in enumerate(zip(left, right)):
    time = i / RATE
    fade = min(1, time / 0.003, max(0, (DURATION - time) / 0.32))
    gain = 0.84 / peak * fade
    pcm.extend(struct.pack('<hh', round(l * gain * 32767), round(r * gain * 32767)))

output = Path(__file__).resolve().parents[1] / 'public' / 'promo-beat.wav'
with wave.open(str(output), 'wb') as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(pcm)
print(f'{output}: {DURATION} seconds, 120 BPM, 48 kHz stereo')
