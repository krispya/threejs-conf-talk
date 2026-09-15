import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { transformSync } from '@babel/core';
import compiler from 'babel-plugin-react-compiler';

void test('all presentation components and hooks are accepted by React Compiler', async () => {
  const source = new URL('../src/', import.meta.url);
  const files = (await readdir(source, { recursive: true })).filter((file) => /\.tsx?$/.test(file));
  let compiled = 0;
  for (const file of files) {
    const events = [];
    transformSync(await readFile(new URL(file, source), 'utf8'), {
      filename: file,
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [
        [
          compiler,
          {
            target: '19',
            panicThreshold: 'all_errors',
            logger: { logEvent: (_, event) => events.push(event) },
          },
        ],
      ],
    });
    assert.deepEqual(
      events.filter((event) => event.kind === 'CompileError' || event.kind === 'CompileSkip'),
      [],
      file
    );
    compiled += events.filter((event) => event.kind === 'CompileSuccess').length;
  }
  assert(compiled > 0, 'The compiler must process presentation components and hooks');
});
