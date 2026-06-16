import { disable, enable } from "@tauri-apps/plugin-autostart";

import { useSettings } from "../lib/settings";
import { ACCENTS } from "../lib/theme";
import { play, SOUNDS } from "../lib/sounds";

function MinutesField({
  label,
  secs,
  onChange,
}: {
  label: string;
  secs: number;
  onChange: (secs: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={1}
        max={180}
        value={Math.round(secs / 60)}
        onChange={(e) => {
          const mins = Math.max(1, Math.min(180, Number(e.target.value) || 1));
          onChange(mins * 60);
        }}
      />
      <span className="unit">min</span>
    </label>
  );
}

export function SettingsView() {
  const { settings, update } = useSettings();

  const setLaunchAtLogin = async (on: boolean) => {
    update({ launchAtLogin: on });
    try {
      if (on) await enable();
      else await disable();
    } catch {
      /* plugin may be unavailable in dev; setting is still persisted */
    }
  };

  return (
    <div className="settings-view">
      <section>
        <h2>Durations</h2>
        <MinutesField label="Focus" secs={settings.focusSecs} onChange={(s) => update({ focusSecs: s })} />
        <MinutesField
          label="Short break"
          secs={settings.shortBreakSecs}
          onChange={(s) => update({ shortBreakSecs: s })}
        />
        <MinutesField
          label="Long break"
          secs={settings.longBreakSecs}
          onChange={(s) => update({ longBreakSecs: s })}
        />
        <label className="field">
          <span>Sessions per long break</span>
          <input
            type="number"
            min={1}
            max={12}
            value={settings.sessionsPerLongBreak}
            onChange={(e) =>
              update({ sessionsPerLongBreak: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </label>
      </section>

      <section>
        <h2>Automation</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoStartBreaks}
            onChange={(e) => update({ autoStartBreaks: e.target.checked })}
          />
          <span>Auto-start breaks</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoStartFocus}
            onChange={(e) => update({ autoStartFocus: e.target.checked })}
          />
          <span>Auto-start focus</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(e) => setLaunchAtLogin(e.target.checked)}
          />
          <span>Launch at login</span>
        </label>
      </section>

      <section>
        <h2>Appearance</h2>
        <label className="field">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as typeof settings.theme })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="field">
          <span>Accent</span>
          <div className="accents">
            {Object.entries(ACCENTS).map(([key, color]) => (
              <button
                key={key}
                className={key === settings.accent ? "swatch active" : "swatch"}
                style={{ background: color }}
                title={key}
                onClick={() => update({ accent: key })}
              />
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>Sound</h2>
        <label className="field">
          <span>Alert</span>
          <select
            value={settings.soundId}
            onChange={(e) => update({ soundId: e.target.value })}
          >
            {SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => play(settings.soundId, settings.volume)}>
            Preview
          </button>
        </label>
        <label className="field">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
          <span className="unit">{Math.round(settings.volume * 100)}%</span>
        </label>
      </section>
    </div>
  );
}
