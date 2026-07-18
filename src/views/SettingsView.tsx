import { disable, enable } from "@tauri-apps/plugin-autostart";

import { useSettings, type MenuBarStyle } from "../lib/settings";
import { cn } from "../lib/utils";
import { COLOR_SCHEMES, type ColorScheme } from "../lib/colors";
import { play, SOUNDS } from "../lib/sounds";
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

// Style choices for the menu-bar picker, each with a tiny live-ish preview of
// how the tray renders (thin default vs. filled knockout pill).
const MENU_BAR_OPTIONS: {
  value: MenuBarStyle;
  label: string;
  desc: string;
  preview: React.ReactNode;
}[] = [
  {
    value: "default",
    label: "Default",
    desc: "Thin icon + native text.",
    preview: (
      <span className="flex items-center gap-1 text-[12px] font-medium text-foreground">
        <span className="text-[13px]">◎</span> 12:34
      </span>
    ),
  },
  {
    value: "solid",
    label: "Solid",
    desc: "Filled pill, icon + time cut out.",
    preview: (
      <span className="flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[12px] font-semibold text-background">
        <span className="text-[13px]">◎</span> 12:34
      </span>
    ),
  },
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
        <CardContent className="space-y-3.5">
          <div className="flex items-center gap-3">
            <Label className="flex-1">Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(v) => update({ theme: v as typeof settings.theme })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex-1">Color scheme</Label>
            <div className="flex gap-1">
              {(["focus", "break", "longBreak"] as const).map((k) => (
                <span
                  key={k}
                  className="h-4 w-4 rounded-full border border-border"
                  style={{
                    background:
                      settings.colorScheme === "mono"
                        ? "var(--muted-foreground)"
                        : COLOR_SCHEMES[settings.colorScheme][k],
                  }}
                />
              ))}
            </div>
            <Select
              value={settings.colorScheme}
              onValueChange={(v) => update({ colorScheme: v as ColorScheme })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {COLOR_SCHEMES[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Menu bar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5">
            {MENU_BAR_OPTIONS.map((o) => {
              const active = settings.menuBarStyle === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ menuBarStyle: o.value })}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "border-input hover:bg-muted",
                  )}
                >
                  <div className="flex h-9 items-center justify-center rounded-md bg-muted">
                    {o.preview}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        active ? "border-primary" : "border-input",
                      )}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="text-sm font-medium">{o.label}</span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">{o.desc}</span>
                </button>
              );
            })}
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
