import { useId, useState } from 'react';
import {
  COACH_API_KEY_ENV,
  COACH_DEFAULT_MODEL,
  COACH_PROVIDERS,
  hasKnownPricing,
  needsBaseUrl,
  type CoachProvider,
  type SettingsUpdate,
  type SettingsView,
} from '@devpromax/shared';
import { useTestConnection } from '../../api/hooks.js';
import { Button, Input, Tooltip } from '../../ui/index.js';
import { Row, Section, OptionalNumberField, TextField } from './fields.js';

/**
 * The coach's own settings (ROADMAP P5-8).
 *
 * Until this shipped, the only ways to give the coach a key were the
 * `COACH_API_KEY` environment variable and a hand-written PUT - and the Coach
 * panel's "Open Settings" button, which is the one path a user actually takes,
 * landed on a page with nothing to fill in.
 *
 * The key is write-only in both directions. The server has no route that
 * returns it (`SettingsView` has no `apiKey` field at all), and this component
 * never puts the typed value anywhere but the request: after a save the field is
 * cleared and what is shown is the server's own mask. So the thing on screen is
 * never the thing that was typed, which is what makes a screenshot of this page
 * harmless.
 */

const PROVIDER_LABEL: Record<CoachProvider, string> = {
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  // Shorter than the shared label, which spells out "OpenAI-compatible
  // endpoint": this one sits in a row of buttons (P9-4).
  'openai-compatible': 'Local / custom',
};

/** Three providers, all named. Same reasoning as `ThemeToggle`: labels, not glyphs. */
function ProviderChoice({
  value,
  onChange,
  disabled,
}: {
  value: CoachProvider;
  onChange: (provider: CoachProvider) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Coach provider">
      {COACH_PROVIDERS.map((provider) => (
        <Button
          key={provider}
          size="sm"
          variant={value === provider ? 'secondary' : 'ghost'}
          aria-pressed={value === provider}
          disabled={disabled}
          onClick={() => {
            onChange(provider);
          }}
        >
          {PROVIDER_LABEL[provider]}
        </Button>
      ))}
    </div>
  );
}

/**
 * The key field.
 *
 * `type="password"` because someone pasting a key is often sharing a screen
 * while doing it, and this is the one field in the app where that matters. The
 * paste survives a wrong-field mistake: nothing is sent until Save.
 */
function ApiKeyRow({
  coach,
  saving,
  onSave,
}: {
  coach: SettingsView['coach'];
  saving: boolean;
  onSave: (apiKey: string) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const fromEnv = coach.apiKeySource === 'env';

  const status =
    coach.apiKeyMasked === null
      ? 'No key configured.'
      : fromEnv
        ? `${coach.apiKeyMasked} — from the ${COACH_API_KEY_ENV} environment variable.`
        : `${coach.apiKeyMasked} — stored on this machine.`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <label htmlFor={id} className="text-fg text-sm">
            API key
          </label>
          <p className="text-fg-subtle mt-0.5 text-xs">
            Stored in this machine&apos;s database. Never logged, never exported, and no route
            returns it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id={id}
            type="password"
            mono
            className="w-56"
            autoComplete="off"
            spellCheck={false}
            placeholder={fromEnv ? 'Overridden by the environment' : 'Paste a key'}
            value={typed}
            disabled={saving}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && typed.trim() !== '') {
                event.preventDefault();
                onSave(typed);
                setTyped('');
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={saving || typed.trim() === ''}
            onClick={() => {
              onSave(typed);
              setTyped('');
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6">
        <p className="text-fg-muted font-mono text-xs" data-testid="api-key-status">
          {status}
        </p>
        {coach.apiKeySource === 'settings' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              // An empty string is how the API clears it (settingsService).
              onSave('');
              setTyped('');
            }}
          >
            Clear key
          </Button>
        )}
      </div>

      {fromEnv && (
        <p className="text-fg-subtle text-xs">
          The environment variable wins over anything saved here, so that a shell that already
          exports a key is the key that gets used. Unset it to use a stored one.
        </p>
      )}
    </div>
  );
}

export function CoachSection({
  coach,
  saving,
  onChange,
}: {
  coach: SettingsView['coach'];
  saving: boolean;
  onChange: (patch: SettingsUpdate) => void;
}) {
  const test = useTestConnection();
  const hasKey = coach.apiKeyMasked !== null;

  return (
    <Section
      title="AI coach"
      description="Your own key, your own account. AI Help is the only thing that calls it - nothing here runs on Run or Submit."
    >
      <Row label="Provider" hint="Which vendor AI Help talks to.">
        <ProviderChoice
          value={coach.provider}
          disabled={saving}
          onChange={(provider) => {
            onChange({ coach: { provider } });
          }}
        />
      </Row>

      {needsBaseUrl(coach.provider) && (
        /*
         * Only for the endpoint that has no fixed address (ROADMAP P9-4). For
         * the two vendors the address is a fact about them and a field for it
         * would be a way to break a working configuration.
         */
        <Row
          label="Endpoint"
          hint="Any server that speaks OpenAI's chat API: Ollama, LM Studio, llama.cpp, vLLM, or a gateway. Empty uses Ollama's default."
        >
          <TextField
            label="Endpoint base URL"
            value={coach.baseUrl ?? ''}
            mono
            placeholder="http://127.0.0.1:11434/v1"
            onCommit={(baseUrl) => {
              onChange({ coach: { baseUrl: baseUrl.trim() === '' ? null : baseUrl.trim() } });
            }}
          />
        </Row>
      )}

      <Row
        label="Model"
        hint={
          hasKnownPricing(coach.provider)
            ? `Empty uses ${COACH_DEFAULT_MODEL[coach.provider]}. Pricing for unknown models is estimated at the dearest rate known for the provider.`
            : `Empty uses ${COACH_DEFAULT_MODEL[coach.provider]}. Whatever the endpoint has; the connection test says whether it has heard of this one.`
        }
      >
        <TextField
          label="Coach model"
          value={coach.model ?? ''}
          mono
          placeholder={COACH_DEFAULT_MODEL[coach.provider]}
          onCommit={(model) => {
            onChange({ coach: { model: model.trim() === '' ? null : model.trim() } });
          }}
        />
      </Row>

      <ApiKeyRow
        coach={coach}
        saving={saving}
        onSave={(apiKey) => {
          test.reset();
          onChange({ coach: { apiKey } });
        }}
      />

      <Row
        label="Spend cap per conversation"
        hint={
          hasKnownPricing(coach.provider)
            ? 'In US dollars, estimated from the token counts. Empty means no cap.'
            : 'Not applied to a custom endpoint: what a turn costs there is between you and whoever runs it, and a made-up rate would be worse than none. A model on this machine costs nothing.'
        }
      >
        <OptionalNumberField
          label="Spend cap in US dollars"
          value={coach.spendCapUsd}
          min={0}
          step={0.5}
          placeholder={hasKnownPricing(coach.provider) ? 'none' : 'not applicable'}
          disabled={!hasKnownPricing(coach.provider)}
          onCommit={(spendCapUsd) => {
            onChange({ coach: { spendCapUsd } });
          }}
        />
      </Row>

      <Row
        label="Test connection"
        hint="One cheap request to the provider, to find out now rather than mid-problem."
      >
        <Tooltip content={hasKey ? 'Checks the key and the model' : 'Add a key first'}>
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasKey || test.isPending}
            onClick={() => {
              test.mutate();
            }}
          >
            {test.isPending ? 'Testing…' : 'Test connection'}
          </Button>
        </Tooltip>
      </Row>

      {test.data && (
        <p
          className={test.data.ok ? 'text-success-fg text-xs' : 'text-danger-fg text-xs'}
          role="status"
        >
          {test.data.message}
          {test.data.model !== null && (
            <span className="text-fg-muted font-mono"> ({test.data.model})</span>
          )}
        </p>
      )}
      {test.error && (
        <p className="text-danger-fg text-xs" role="alert">
          {test.error.message}
        </p>
      )}
    </Section>
  );
}
