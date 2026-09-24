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
import { Button, Input, Segmented, cn } from '../../ui/index.js';
import { ControlColumn, Row, Section, OptionalNumberField, TextField } from './fields.js';

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
 * never puts the typed value anywhere but the request: once the server has
 * taken it, the field is cleared and what is shown is the server's own mask
 * (only then, since P3-7 - a refused save used to empty the field all the same,
 * and the key had to be found and pasted again to learn why). So the thing on
 * screen is never the thing that was typed, which is what makes a screenshot
 * of this page harmless.
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
    <Segmented
      label="Coach provider"
      size="sm"
      options={COACH_PROVIDERS.map((provider) => ({
        value: provider,
        label: PROVIDER_LABEL[provider],
        disabled,
      }))}
      value={value}
      onChange={onChange}
    />
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
  /** `onSaved` runs once the server has the key, which is when the field empties. */
  onSave: (apiKey: string, onSaved: () => void) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const save = (apiKey: string) => {
    onSave(apiKey, () => {
      setTyped('');
    });
  };
  const fromEnv = coach.apiKeySource === 'env';

  const status =
    coach.apiKeyMasked === null
      ? 'No key configured.'
      : fromEnv
        ? `${coach.apiKeyMasked} — from the ${COACH_API_KEY_ENV} environment variable.`
        : `${coach.apiKeyMasked} — stored on this machine.`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="text-fg text-sm">
            API key
          </label>
          <p className="text-fg-subtle mt-0.5 text-xs">
            The key for the provider above - each vendor issues its own. Stored in this
            machine&apos;s database; never logged, never exported, and no route returns it.
          </p>
        </div>
        <ControlColumn>
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
                save(typed);
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={saving || typed.trim() === ''}
            onClick={() => {
              save(typed);
            }}
          >
            Save
          </Button>
        </ControlColumn>
      </div>

      <div className="flex items-center justify-between gap-6">
        {/* Mono only when it shows a key: the app's own words are in sans (P9-6). */}
        <p
          className={cn('text-fg-muted text-xs', coach.apiKeyMasked !== null && 'font-mono')}
          data-testid="api-key-status"
        >
          {status}
        </p>
        {coach.apiKeySource === 'settings' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              // An empty string is how the API clears it (settingsService).
              save('');
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
  error,
  onChange,
}: {
  coach: SettingsView['coach'];
  saving: boolean;
  /** The last write from this card, if the server refused it (P3-7). */
  error: Error | null;
  onChange: (patch: SettingsUpdate, onSaved?: () => void) => void;
}) {
  const test = useTestConnection();
  const hasKey = coach.apiKeyMasked !== null;
  /**
   * The provider this screen switched away from while a key was configured.
   *
   * A key belongs to one vendor, and there is one key field: after Anthropic
   * becomes Gemini the stored key is very likely an Anthropic one, and the first
   * sign of it used to be a rejected turn mid-problem (P3-7).
   */
  const [switchedFrom, setSwitchedFrom] = useState<CoachProvider | null>(null);
  const keyMayBeStale = hasKey && switchedFrom !== null && switchedFrom !== coach.provider;

  return (
    <Section
      title="AI coach"
      description="Your own key, your own account. AI Help is the only thing that calls it - nothing here runs on Run or Submit."
      error={error}
    >
      <Row label="Provider" hint="Which vendor AI Help talks to.">
        <ProviderChoice
          value={coach.provider}
          disabled={saving}
          onChange={(provider) => {
            if (hasKey && switchedFrom === null) setSwitchedFrom(coach.provider);
            // The model goes with the vendor (P3-7): `claude-opus-5` sent to
            // Gemini is a 404 on the first turn, and the empty field that
            // replaces it means the new provider's own default.
            onChange({ coach: { provider, model: null } });
          }}
        />
      </Row>

      {keyMayBeStale && (
        <p className="text-warn-fg text-xs" role="status">
          Keys are per vendor, and the stored key may be for {PROVIDER_LABEL[switchedFrom]} rather
          than {PROVIDER_LABEL[coach.provider]}. Paste the {PROVIDER_LABEL[coach.provider]} one
          below if so.
        </p>
      )}

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
        onSave={(apiKey, onSaved) => {
          test.reset();
          onChange({ coach: { apiKey } }, () => {
            // A key saved after the switch is the new vendor's.
            setSwitchedFrom(null);
            onSaved();
          });
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

      {/*
        Why the button cannot be pressed is said in the row, where it can be
        read (P3-7). It was a tooltip on the disabled button, and a disabled
        button takes no focus and no hover - so nobody could ever see it.
      */}
      <Row
        label="Test connection"
        hint={
          hasKey
            ? 'One cheap request to the provider, to check the key and the model now rather than mid-problem.'
            : 'Add a key first. Then one cheap request to the provider checks the key and the model.'
        }
      >
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
