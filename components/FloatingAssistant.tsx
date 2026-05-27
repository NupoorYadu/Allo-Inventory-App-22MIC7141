'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Mic, X } from 'lucide-react';
import { buildOperationsInsights, resolveVoiceCommand } from '@/lib/ops-intelligence';

function speakText(text: string) {
  if (typeof window === 'undefined') return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(u);
}

function voiceRecognitionFactory() {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  const ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!ctor) return null;
  return new ctor();
}

export default function FloatingAssistant() {
  const [open, setOpen] = useState(true);
  const [insights, setInsights] = useState<any[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  async function refresh() {
    try {
      const [productsRes, reservationsRes] = await Promise.all([fetch('/api/products'), fetch('/api/reservations')]);
      const products = await productsRes.json().catch(() => []);
      const reservations = await reservationsRes.json().catch(() => []);
      const snapshot = { products, reservations, stressResults: null, lastSync: new Date(), refreshMs: null, loading: false, error: null };
      const ops = buildOperationsInsights(snapshot as any);
      setInsights(ops);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    // schedule refresh on next tick to avoid calling setState synchronously in effect
    const init = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 10000);
    return () => {
      clearTimeout(init);
      clearInterval(t);
    };
  }, []);

  function toggleListen() {
    if (listening) return setListening(false);
    const recog = voiceRecognitionFactory();
    if (!recog) {
      setTranscript('Voice not supported in this browser');
      return;
    }

    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onstart = () => {
      setListening(true);
      setTranscript('');
    };

    recog.onresult = (ev: any) => {
      const arr = Array.from(ev.results || []) as any[];
      const text = arr.map((r: any) => r[0]?.transcript ?? '').join(' ').trim();
      setTranscript(text);
      const final = arr[arr.length - 1] as any;
      if (final?.isFinal && text) {
        const cmd = resolveVoiceCommand(text) as any;
        if (cmd?.speak) speakText(cmd.speak);
      }
    };

    recog.onerror = () => {
      setTranscript('Voice input failed');
      setListening(false);
    };

    recog.onend = () => setListening(false);
    recog.start();
  }

  return (
    <div className="floating-ai">
      <button aria-label="Open AI Copilot" className="floating-button" onClick={() => setOpen((s) => !s)}>
        <span className="pulse" />
        <Sparkles className="icon" />
      </button>

      {open && (
        <div className="floating-panel">
          <div className="header">
            <div className="title">AI Ops Copilot</div>
            <button onClick={() => setOpen(false)} className="close"><X className="h-4 w-4" /></button>
          </div>

          <div className="content">
            <div className="top">
              <div className="big">Live AI insights</div>
              <div className="sub">Operational intelligence and voice controls</div>
            </div>

            <div className="insights">
              {insights.slice(0, 4).map((ins: any) => (
                <div key={ins.title} className="insight-card">
                  <div className="insight-title">{ins.title}</div>
                  <div className="insight-summary">{ins.summary}</div>
                </div>
              ))}
            </div>

            <div className="voice-bar">
              <button onClick={toggleListen} className={`mic ${listening ? 'listening' : ''}`} aria-label="Toggle voice">
                <Mic className="h-4 w-4" />
              </button>
              <div className="waveform" aria-hidden>
                <span /><span /><span /><span /><span />
              </div>
              <div className="transcript">{transcript || 'Say: show low stock products'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
