import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { settingsSchema } from '@devpromax/shared';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';

let repos: Repositories;

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('settings', () => {
  it('returns complete defaults on a first run', () => {
    expect(repos.settings.get()).toEqual(settingsSchema.parse({}));
  });

  it('merges a partial update into one section without disturbing the others', () => {
    repos.settings.update({ editor: { fontSize: 18 } });
    repos.settings.update({ editor: { vimKeybindings: true } });

    const settings = repos.settings.get();
    expect(settings.editor.fontSize).toBe(18);
    expect(settings.editor.vimKeybindings).toBe(true);
    // Untouched fields keep their defaults rather than being blanked.
    expect(settings.editor.tabSize).toBe(settingsSchema.parse({}).editor.tabSize);
    expect(settings.theme).toBe('system');
  });

  it('persists scalar sections', () => {
    repos.settings.update({ theme: 'dark', lastLanguage: 'java' });

    expect(repos.settings.get().theme).toBe('dark');
    expect(repos.settings.get().lastLanguage).toBe('java');
  });

  it('returns the merged settings from update, matching a later read', () => {
    const returned = repos.settings.update({ judge: { concurrency: 4 } });
    expect(returned).toEqual(repos.settings.get());
  });

  it('stores the coach API key and gives it back to the server', () => {
    // Masking is the API layer's job (P3-4); the repository is where the real
    // key has to live, or nothing could ever call a provider.
    repos.settings.update({ coach: { apiKey: 'sk-ant-secret', provider: 'anthropic' } });
    expect(repos.settings.get().coach.apiKey).toBe('sk-ant-secret');
  });

  it('clears the key when it is set to null', () => {
    repos.settings.update({ coach: { apiKey: 'sk-ant-secret' } });
    repos.settings.update({ coach: { apiKey: null } });

    expect(repos.settings.get().coach.apiKey).toBeNull();
  });

  it('rejects a value outside the schema and leaves the stored settings alone', () => {
    repos.settings.update({ editor: { fontSize: 18 } });

    expect(() => repos.settings.update({ editor: { fontSize: 200 } })).toThrow();
    expect(repos.settings.get().editor.fontSize).toBe(18);
  });

  it('falls back to defaults for an unreadable row instead of refusing to start', () => {
    repos.settings.update({ theme: 'dark', editor: { fontSize: 20 } });
    repos.db.prepare("UPDATE settings SET value = '{not json' WHERE key = 'editor'").run();

    const settings = repos.settings.get();
    expect(settings.editor.fontSize).toBe(settingsSchema.parse({}).editor.fontSize);
    expect(settings.theme).toBe('dark');
  });

  it('ignores a key that is not part of the settings schema', () => {
    repos.db.prepare("INSERT INTO settings (key, value) VALUES ('leftover', '1')").run();
    expect(repos.settings.get()).toEqual(settingsSchema.parse({}));
  });

  it('resets everything to defaults', () => {
    repos.settings.update({ theme: 'dark', coach: { apiKey: 'sk-ant-secret' } });

    expect(repos.settings.reset()).toEqual(settingsSchema.parse({}));
    expect(repos.settings.get().coach.apiKey).toBeNull();
  });
});
