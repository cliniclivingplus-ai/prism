// src/app/api/compass/import-transcript/route.ts
//
// Exports transcript text from a Drive file the coach picked.
// Handles THREE file types, because coaches' transcripts come in different forms:
//   1. Native Google Doc  → Meet's own auto-saved transcript (export as text)
//   2. Plain text (.txt)   → e.g. a Whisper-generated transcript (download raw)
//   3. Word doc (.docx)    → an exported/old Word transcript (download + extract)
//
// Requires: npm i mammoth   (only used for .docx parsing)
//
// Runtime note: mammoth needs Node APIs. On Vercel this is fine. On Cloudflare
// Pages, enable the `nodejs_compat` flag; if .docx still fails there, the
// Google-Doc and .txt paths still work with zero dependencies.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const MIME = {
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
};

export async function POST(req: Request) {
  try {
    const { fileId, accessToken } = await req.json();
    if (!fileId || !accessToken) {
      return Response.json({ error: 'Missing fileId or accessToken' }, { status: 400 });
    }

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // 1. Read metadata (name + mimeType) so we know how to pull the text.
    const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType`, { headers: authHeader });
    if (!metaRes.ok) {
      if (metaRes.status === 401) {
        return Response.json({ error: 'Google session expired. Reconnect Drive and try again.' }, { status: 401 });
      }
      if (metaRes.status === 404) {
        return Response.json({ error: 'File not found, or this Google account cannot access it.' }, { status: 404 });
      }
      return Response.json({ error: `Drive API error (${metaRes.status}).` }, { status: 502 });
    }
    const meta = await metaRes.json();
    const mimeType: string = meta.mimeType;

    let text = '';

    // 2. Extract text based on file type.
    if (mimeType === MIME.GOOGLE_DOC) {
      // Native Google Doc → export as plain text
      const r = await fetch(`${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`, { headers: authHeader });
      if (!r.ok) return Response.json({ error: `Failed to export Google Doc (${r.status}).` }, { status: 502 });
      text = await r.text();

    } else if (mimeType === MIME.TXT) {
      // Plain text file (e.g. Whisper output) → download raw content
      const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: authHeader });
      if (!r.ok) return Response.json({ error: `Failed to download text file (${r.status}).` }, { status: 502 });
      text = await r.text();

    } else if (mimeType === MIME.DOCX) {
      // Word document → download bytes, extract raw text with mammoth
      const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: authHeader });
      if (!r.ok) return Response.json({ error: `Failed to download Word file (${r.status}).` }, { status: 502 });
      const buffer = Buffer.from(await r.arrayBuffer());
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else {
      // Anything else (video, PDF, sheet, slides…) → clear guidance
      return Response.json(
        {
          error:
            'That file type can\'t be read as a transcript. Supported: a Google Doc, a plain-text (.txt) transcript, or a Word (.docx) file. If you picked a video recording, open its transcript Doc instead — or right-click the file in Drive → Open with → Google Docs.',
          mimeType,
        },
        { status: 422 }
      );
    }

    // 3. Sanity-check the result.
    if (!text || text.trim().length < 20) {
      return Response.json(
        { error: 'The transcript came back empty. If this is a fresh Meet recording, it may still be processing — try again in a bit.' },
        { status: 422 }
      );
    }

    return Response.json({ text, fileName: meta.name });
  } catch (err) {
    console.error('import-transcript error:', err);
    return Response.json({ error: 'Unexpected error importing transcript.' }, { status: 500 });
  }
}