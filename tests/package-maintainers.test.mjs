import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeMaintainerPortrait } from '../src/view/package-maintainer-layout.ts';

void test('maintainers float independently along label edges at one small local size', () => {
  for (const width of [1, 3, 5]) {
    const first = new Float32Array(4);
    const second = new Float32Array(4);
    const positions = [];
    for (const time of [0, 2, 5, 12]) {
      assert.equal(placeMaintainerPortrait(first, width, 0.36, 0.22, 4, 0, 2, time), first);
      placeMaintainerPortrait(second, width, 0.36, 0.22, 4, 1, 2, time);
      assert.equal(first[3], second[3]);
      assert(Math.abs(first[3] - 0.22) < 1e-6);
      assert(first[1] > 0 && second[1] < 0, 'Co-maintainers float on separate label edges');
      for (const portrait of [first, second]) {
        assert(Math.abs(portrait[1]) > 0.18, 'Portrait centers remain outside the label');
        assert(Math.abs(portrait[1]) - portrait[3] < 0.18, 'Portraits overlap the label slightly');
        assert(portrait[2] > 0.01, 'Portraits stay in front of the label and its text');
        assert(Math.abs(portrait[0]) < width * 0.5 + portrait[3]);
      }
      positions.push([first[0], first[1], second[0], second[1]]);
    }
    assert.equal(new Set(positions.map(String)).size, positions.length);
    assert.notEqual(positions[1][0] - positions[0][0], positions[1][2] - positions[0][2]);
  }
});
