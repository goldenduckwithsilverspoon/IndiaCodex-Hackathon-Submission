import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function run() {
  const server = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });
  try {
    await sleep(800); // give server time

    const data = new TextEncoder().encode('hello world');
    const blob = new Blob([data], { type: 'text/plain' });
    const form = new FormData();
    form.append('file', blob, 'hello.txt');

    const up = await fetchJson('http://localhost:3000/api/upload', { method: 'POST', body: form });
    assert.ok(up.cid && typeof up.cid === 'string');

    const fileRes = await fetch(`http://localhost:3000/content/${up.cid}`);
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    assert.equal(new TextDecoder().decode(buf), 'hello world');

    console.log('SMOKE TEST PASS');
  } finally {
    server.kill('SIGINT');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
