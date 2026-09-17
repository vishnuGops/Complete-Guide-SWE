import { describe, it, expect } from 'vitest';
import {
  maskApiKey,
  settingsSchema,
  settingsUpdateSchema,
  settingsViewSchema,
} from './settings.js';

describe('settingsSchema', () => {
  it('builds a complete settings object from nothing', () => {
    const parsed = settingsSchema.parse({});
    expect(parsed.coach.provider).toBe('anthropic');
    expect(parsed.coach.apiKey).toBeNull();
    expect(parsed.coach.spendCapUsd).toBeNull();
    expect(parsed.editor.tabSize).toBe(4);
    expect(parsed.judge.concurrency).toBe(2);
    expect(parsed.theme).toBe('system');
    expect(parsed.lastLanguage).toBe('python');
  });

  it('keeps nested defaults when only one field is supplied', () => {
    const parsed = settingsSchema.parse({ editor: { fontSize: 18 } });
    expect(parsed.editor.fontSize).toBe(18);
    expect(parsed.editor.tabSize).toBe(4);
  });

  it('rejects out-of-range editor and judge values', () => {
    expect(settingsSchema.safeParse({ editor: { fontSize: 4 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ judge: { concurrency: 0 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ judge: { timeoutMultiplier: 10 } }).success).toBe(false);
  });

  it('rejects an unknown provider', () => {
    expect(settingsSchema.safeParse({ coach: { provider: 'openai' } }).success).toBe(false);
  });
});

describe('settingsUpdateSchema', () => {
  it('accepts a single nested field', () => {
    const parsed = settingsUpdateSchema.parse({ coach: { model: 'claude-opus-5' } });
    expect(parsed.coach?.model).toBe('claude-opus-5');
    expect(parsed.editor).toBeUndefined();
  });

  it('accepts an empty update', () => {
    expect(settingsUpdateSchema.parse({})).toEqual({});
  });
});

describe('maskApiKey', () => {
  it('returns null for absent or blank keys', () => {
    expect(maskApiKey(null)).toBeNull();
    expect(maskApiKey(undefined)).toBeNull();
    expect(maskApiKey('')).toBeNull();
    expect(maskApiKey('   ')).toBeNull();
  });

  it('reveals only the last four characters', () => {
    const masked = maskApiKey('sk-ant-api03-abcdefghijklmnop');
    expect(masked).toBe('••••••••mnop');
    expect(masked).not.toContain('abcdefgh');
  });

  it('reveals nothing at all for a short key', () => {
    expect(maskApiKey('abcd1234')).toBe('••••••••');
  });
});

describe('settingsViewSchema', () => {
  it('has no apiKey field at all, so the raw key cannot leak through the API', () => {
    const view = settingsViewSchema.parse({
      coach: {
        provider: 'gemini',
        model: null,
        spendCapUsd: null,
        apiKeyMasked: '••••••••mnop',
        apiKeySource: 'settings',
      },
      editor: {},
      judge: {},
      theme: 'dark',
      lastLanguage: 'java',
    });
    expect('apiKey' in view.coach).toBe(false);
    expect(view.coach.apiKeyMasked).toBe('••••••••mnop');
  });

  it('strips an apiKey that is passed in anyway', () => {
    const view = settingsViewSchema.parse({
      coach: {
        provider: 'anthropic',
        model: null,
        spendCapUsd: null,
        apiKey: 'sk-ant-leaked',
        apiKeyMasked: null,
        apiKeySource: 'none',
      },
      editor: {},
      judge: {},
      theme: 'system',
      lastLanguage: 'python',
    });
    expect(JSON.stringify(view)).not.toContain('sk-ant-leaked');
  });
});
