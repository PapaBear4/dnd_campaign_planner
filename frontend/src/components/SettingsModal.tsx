import React, { useState, useEffect, useRef } from 'react';
import { Key, Sparkles, Server, Check, X, ShieldAlert, RefreshCw, AlertCircle, Cpu } from 'lucide-react';
import { getSettings, queryAvailableModels, updateSettings } from '../api';
import { AppSettings, GeminiModelInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

const DEFAULT_MODELS: GeminiModelInfo[] = [
  { id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash', description: 'Fastest response time, 1M context' },
  { id: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', description: 'Deep worldbuilding, complex reasoning' },
  { id: 'gemini-2.0-flash', display_name: 'Gemini 2.0 Flash', description: 'Next-generation fast model' },
  { id: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', description: 'Standard fast generation' },
  { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', description: 'Standard reasoning model' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsSaved }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [customModel, setCustomModel] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic models state
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>(DEFAULT_MODELS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelQuerySource, setModelQuerySource] = useState<'api' | 'fallback' | 'error'>('fallback');
  const [modelQueryError, setModelQueryError] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);

  const fetchModels = async (keyToUse?: string) => {
    setIsFetchingModels(true);
    setModelQueryError(null);
    try {
      const res = await queryAvailableModels(keyToUse);
      if (res.models && res.models.length > 0) {
        setAvailableModels(res.models);
      }
      if (res.error) {
        setModelQueryError(res.error);
        setModelQuerySource('error');
      } else if (res.source === 'api') {
        setModelQuerySource('api');
        // If current model is not in the newly fetched models, keep current if valid or select top flash model
        const modelExists = res.models.some((m) => m.id === model);
        if (!modelExists && model !== 'custom') {
          setModel(res.models[0].id);
        }
      } else {
        setModelQuerySource('fallback');
      }
    } catch (err: any) {
      setModelQueryError(err.message || 'Failed to query models from server');
      setModelQuerySource('error');
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      getSettings().then((s) => {
        setSettings(s);
        if (s.gemini_model) {
          setModel(s.gemini_model);
        }
        // If an API key is already configured on the server, query server for available models right away
        if (s.gemini_api_key_configured) {
          fetchModels();
        }
      });
    }
  }, [isOpen]);

  // When the user enters an API key, automatically query the server for the model list (debounced)
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const cleanKey = val.trim();
    if (cleanKey.length >= 10) {
      debounceTimerRef.current = setTimeout(() => {
        fetchModels(cleanKey);
      }, 600);
    } else if (!cleanKey) {
      setModelQueryError(null);
      setModelQuerySource('fallback');
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const selectedModel = model === 'custom' ? (customModel.trim() || 'gemini-2.5-flash') : model;
      const payload: any = { gemini_model: selectedModel };
      if (apiKey.trim()) {
        payload.gemini_api_key = apiKey.trim();
      }
      await updateSettings(payload);
      setSavedSuccess(true);
      if (onSettingsSaved) onSettingsSaved();
      // Re-fetch models with newly saved key if not already done
      fetchModels(apiKey.trim() || undefined);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 14, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '580px',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        border: '1px solid var(--border-medium)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f1420'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Campaign Settings &amp; AI Engine</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Configure Gemini Co-DM and Local Network sharing</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Gemini API Key */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                Gemini API Key
              </label>
              <button
                type="button"
                onClick={() => fetchModels(apiKey.trim() || undefined)}
                disabled={isFetchingModels}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--color-gold)' }}
                title="Query server to fetch available models for this key"
              >
                <RefreshCw size={13} className={isFetchingModels ? 'pulse-gold' : ''} />
                {isFetchingModels ? 'Querying...' : 'Query Models'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder={settings?.gemini_api_key_configured ? "•••••••••••••••• (Configured - enter new to change)" : "Paste AIzaSy... API Key"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  paddingLeft: '38px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            </div>

            {/* Status / Feedback message below API Key */}
            <div style={{ marginTop: '8px', fontSize: '0.78rem' }}>
              {isFetchingModels && (
                <span style={{ color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  Querying Gemini server for available models...
                </span>
              )}
              {!isFetchingModels && modelQuerySource === 'api' && (
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} />
                  Connected! Queried server: {availableModels.length} models available for your key.
                </span>
              )}
              {!isFetchingModels && modelQueryError && (
                <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  {modelQueryError}
                </span>
              )}
              {!isFetchingModels && !modelQueryError && modelQuerySource !== 'api' && (
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {settings?.gemini_api_key_configured ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Key saved. Enter new key or click Query Models to refresh.
                    </span>
                  ) : (
                    <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={14} /> Offline guidance mode is active until key is entered.
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} style={{ color: 'var(--color-arcane-cyan)' }} />
                Gemini AI Model
              </label>
              {modelQuerySource === 'api' && (
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Live API List
                </span>
              )}
            </div>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} ({m.id}) {m.description ? `• ${m.description.slice(0, 45)}...` : ''}
                </option>
              ))}
              <option value="custom">Custom Model Identifier...</option>
            </select>

            {model === 'custom' && (
              <input
                type="text"
                placeholder="e.g. gemini-3.8-flash or custom endpoint name"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            )}
          </div>

          {/* Local LAN Sharing Info */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Server size={16} style={{ color: 'var(--color-arcane-cyan)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Local Network (LAN) Player Access</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The server listens on all interfaces (<code>0.0.0.0</code>). Players on your Wi-Fi can open:
            </p>
            <div style={{
              background: '#0a0e17',
              padding: '6px 10px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--color-gold)',
              marginTop: '6px'
            }}>
              http://&lt;your-local-ip&gt;:3000/player
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            {savedSuccess && (
              <span style={{ color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={16} /> Settings saved!
              </span>
            )}
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
