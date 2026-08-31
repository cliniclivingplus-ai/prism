// src/components/ImportFromDrive.tsx
//
// Step 3 of the Google Drive transcript import feature.
// Renders a button that: gets a short-lived OAuth access token via Google
// Identity Services (no server-side secret involved), opens Google Picker
// scoped to Google Docs, and on selection POSTs to /api/compass/import-transcript.
//
// Requires two scripts loaded globally — see layout.tsx snippet below.
// Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY (Step 1).

'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileText } from 'lucide-react';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface ImportFromDriveProps {
  onImport: (text: string, fileName: string) => void;
  onError?: (message: string) => void;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY as string;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export default function ImportFromDrive({ onImport, onError }: ImportFromDriveProps) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Poll until both Google scripts (loaded in layout.tsx) are available,
  // then load the Picker module of gapi.
  useEffect(() => {
    const check = setInterval(() => {
      if (window.google?.accounts?.oauth2 && window.gapi) {
        window.gapi.load('picker', () => setReady(true));
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, []);

  const openPicker = useCallback(
    (accessToken: string) => {
      const picker = new window.google.picker.PickerBuilder()
        .addView(
          new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(false)
        )
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .setTitle('Select the meeting transcript Doc')
        .setCallback(async (data: any) => {
          if (data.action !== window.google.picker.Action.PICKED) return;

          const file = data.docs[0];
          setLoading(true);
          try {
            const res = await fetch('/api/compass/import-transcript', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: file.id, accessToken }),
            });
            const json = await res.json();

            if (!res.ok) {
              onError?.(json.error || 'Failed to import transcript.');
              return;
            }
            onImport(json.text, json.fileName);
          } catch {
            onError?.('Network error while importing transcript.');
          } finally {
            setLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
    },
    [onImport, onError]
  );

  const handleClick = useCallback(() => {
    if (!CLIENT_ID || !API_KEY) {
      // Without these, Google's script fails silently (no popup, no callback) —
      // surface it instead of leaving the button looking dead.
      onError?.('Google Drive import is not configured on this deployment (missing Client ID / API key env vars).');
      return;
    }
    if (!ready) {
      onError?.('Google Drive import is still loading — try again in a moment.');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response: any) => {
        if (response.error) {
          onError?.('Google sign-in was cancelled or failed.');
          return;
        }
        openPicker(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  }, [ready, openPicker, onError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid #C8E9A8',
        background: loading ? '#F2F9EC' : '#fff',
        color: '#538A22',
        fontWeight: 600,
        fontSize: 14,
        cursor: loading ? 'default' : 'pointer',
      }}
    >
      {loading ? 'Importing…' : <><FileText size={14} /> Import from Drive</>}
    </button>
  );
}