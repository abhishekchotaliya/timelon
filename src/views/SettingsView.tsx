import { disable, enable } from "@tauri-apps/plugin-autostart";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";

import { useSettings, type MenuBarStyle } from "../lib/settings";
import type { ThemeMode } from "../lib/theme";
import { cn } from "../lib/utils";
import { COLOR_SCHEMES, type ColorScheme } from "../lib/colors";
import { play, SOUNDS } from "../lib/sounds";
import { TrayPreview } from "../components/TrayPreview";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";

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
    <div className="flex items-center gap-3">
      <Label className="flex-1">{label}</Label>
      <input
        type="number"
        min={1}
        max={180}
        value={Math.round(secs / 60)}
        onChange={(e) => {
          const mins = Math.max(1, Math.min(180, Number(e.target.value) || 1));
          onChange(mins * 60);
        }}
        className="h-9 w-[70px] rounded-md border border-input bg-muted px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="min-w-9 text-[13px] text-muted-foreground">min</span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// A selectable card with a preview swatch + radio dot. Reused by the menu-bar,
// theme, and color-scheme pickers in place of dropdowns.
function OptionCard({
  active,
  onClick,
  preview,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  preview: ReactNode;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary ring-1 ring-primary" : "border-input hover:bg-muted",
      )}
    >
      <div className="flex h-9 items-center justify-center rounded-md bg-muted">{preview}</div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border",
            active ? "border-primary" : "border-input",
          )}
        >
          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {desc && <span className="text-[12px] text-muted-foreground">{desc}</span>}
    </button>
  );
}

// Style choices for the menu-bar picker. Previews are drawn by <TrayPreview>
// with the same code as the real tray, so the font/layout matches exactly.
const MENU_BAR_OPTIONS: { value: MenuBarStyle; label: string; desc: string }[] = [
  { value: "default", label: "Default", desc: "Thin icon + time." },
  { value: "solid", label: "Solid", desc: "Filled pill, icon + time cut out." },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

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
    <div className="max-w-[560px] space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Durations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MinutesField
            label="Focus"
            secs={settings.focusSecs}
            onChange={(s) => update({ focusSecs: s })}
          />
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
          <div className="flex items-center gap-3">
            <Label className="flex-1">Sessions per long break</Label>
            <input
              type="number"
              min={1}
              max={12}
              value={settings.sessionsPerLongBreak}
              onChange={(e) =>
                update({ sessionsPerLongBreak: Math.max(1, Number(e.target.value) || 1) })
              }
              className="h-9 w-[70px] rounded-md border border-input bg-muted px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="min-w-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <ToggleRow
            label="Auto-start breaks"
            checked={settings.autoStartBreaks}
            onChange={(on) => update({ autoStartBreaks: on })}
          />
          <ToggleRow
            label="Auto-start focus"
            checked={settings.autoStartFocus}
            onChange={(on) => update({ autoStartFocus: on })}
          />
          <ToggleRow
            label="Launch at login"
            checked={settings.launchAtLogin}
            onChange={setLaunchAtLogin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <OptionCard
                  key={value}
                  active={settings.theme === value}
                  onClick={() => update({ theme: value })}
                  label={label}
                  preview={<Icon className="h-4 w-4 text-foreground" />}
                />
              ))}
            </div>
          </div>
          <div className="border-t border-border" />
          <div className="space-y-2">
            <Label>Color scheme</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map((k) => (
                <OptionCard
                  key={k}
                  active={settings.colorScheme === k}
                  onClick={() => update({ colorScheme: k })}
                  label={COLOR_SCHEMES[k].label}
                  preview={
                    <div className="flex gap-1">
                      {(["focus", "break", "longBreak"] as const).map((c) => (
                        <span
                          key={c}
                          className="h-4 w-4 rounded-full border border-border"
                          style={{
                            background:
                              k === "mono" ? "var(--muted-foreground)" : COLOR_SCHEMES[k][c],
                          }}
                        />
                      ))}
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Menu bar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {MENU_BAR_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                active={settings.menuBarStyle === o.value}
                onClick={() => update({ menuBarStyle: o.value })}
                preview={<TrayPreview style={o.value} />}
                label={o.label}
                desc={o.desc}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex-1">
              Size
              <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                Scales the icon + time in the menu bar.
              </span>
            </Label>
            <Slider
              className="w-[160px]"
              min={0.5}
              max={2}
              step={0.1}
              value={[settings.menuBarScale]}
              onValueChange={([v]) => update({ menuBarScale: v })}
            />
            <span className="min-w-10 text-right text-[13px] tabular-nums text-muted-foreground">
              {Math.round(settings.menuBarScale * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sound</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="flex items-center gap-3">
            <Label className="flex-1">Alert</Label>
            <Select value={settings.soundId} onValueChange={(v) => update({ soundId: v })}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUNDS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => play(settings.soundId, settings.volume)}
            >
              Preview
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex-1">Volume</Label>
            <Slider
              className="w-[160px]"
              min={0}
              max={1}
              step={0.05}
              value={[settings.volume]}
              onValueChange={([v]) => update({ volume: v })}
            />
            <span className="min-w-9 text-[13px] text-muted-foreground">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
