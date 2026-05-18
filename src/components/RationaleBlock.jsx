import React, { useState } from 'react';

export default function RationaleBlock({ inputs, recommendation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setText('');
    try {
      const res = await fetch('/api/rationale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, recommendation })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed with status ' + res.status);
      }
      setText(data.rationale || '');
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const hasOutput = text || error || loading;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Proposal language
        </h2>
        {text ? (
          <button
            onClick={copy}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        ) : null}
      </header>

      <div className="px-5 py-5">
        {!hasOutput ? (
          <button
            onClick={generate}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Generate proposal language
          </button>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            Writing rationale...
          </div>
        ) : null}

        {error ? (
          <div className="space-y-3">
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
              {error}
            </div>
            <button
              onClick={generate}
              className="px-3 py-1.5 rounded-md bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300"
            >
              Retry
            </button>
          </div>
        ) : null}

        {text && !loading ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-md p-4">
              {text}
            </div>
            <button
              onClick={generate}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Regenerate
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
