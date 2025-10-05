export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function listFiles() {
  const res = await fetch('/api/files');
  if (!res.ok) throw new Error('List failed');
  return res.json();
}

export async function getFile(cid) {
  const res = await fetch(`/content/${cid}`);
  if (!res.ok) throw new Error('Not found');
  return res.arrayBuffer();
}
