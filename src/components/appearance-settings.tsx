"use client";
import { useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { themePresets, palettePreset, type Palette } from "@/lib/theme";
import { useLocale } from "./providers";
import { Field } from "./ui";
const subscribe = () => () => {};
export function DisplaySettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { t, locale } = useLocale();
  return (
    <section className="panel dialog-body appearance-mode">
      <div className="settings-heading">
        <h2>{locale === "th" ? "การแสดงผล" : "Display"}</h2>
        <p className="hint">
          {locale === "th"
            ? "ใช้กับเครื่องนี้ สีของโรงเรียนกำหนดโดยผู้ดูแล"
            : "Applies to this device. School colors are set by your administrator."}
        </p>
      </div>
      <div className="display-modes" aria-label={t("theme")}>
        {(
          [
            ["light", Sun],
            ["dark", Moon],
            ["system", Monitor],
          ] as const
        ).map(([mode, Icon]) => (
          <button
            key={mode}
            type="button"
            className={`button ${mounted && theme === mode ? "mode-selected" : ""}`}
            aria-pressed={mounted && theme === mode}
            onClick={() => setTheme(mode)}
          >
            <Icon size={18} />
            <span>{t(mode)}</span>
            {mounted && theme === mode && <Check size={16} />}
          </button>
        ))}
      </div>
    </section>
  );
}
export function AppearanceFields({ initial }: { initial: Palette }) {
  const [palette, setPalette] = useState(initial);
  const { locale } = useLocale();
  const th = locale === "th";
  const preset = palettePreset(palette);
  return (
    <fieldset className="settings-section">
      <legend>{th ? "Theme และสีของโรงเรียน" : "School theme & colors"}</legend>
      <div className="settings-heading">
        <p className="hint">
          {th
            ? "เลือกชุดสีสำเร็จรูป หรือปรับสีเอง แล้วกดบันทึกเพื่อใช้ทั้งโรงเรียน"
            : "Choose a preset or customize colors, then save to apply across the school."}
        </p>
        <span className="badge">
          {preset ? (th ? preset.th : preset.en) : "Custom"}
        </span>
      </div>
      <div className="theme-presets">
        {themePresets.map((item) => (
          <button
            key={item.id}
            className={`theme-preset ${preset?.id === item.id ? "selected" : ""}`}
            type="button"
            aria-pressed={preset?.id === item.id}
            onClick={() => setPalette(item)}
          >
            <span className="palette-swatches" aria-hidden="true">
              {[
                item.primary_color,
                item.secondary_color,
                item.background_color,
                item.background_color_dark,
              ].map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </span>
            <span>{th ? item.th : item.en}</span>
            {preset?.id === item.id && <Check size={16} />}
          </button>
        ))}
      </div>
      <div className="form-grid">
        {(
          [
            ["primary_color", th ? "สีหลัก" : "Primary"],
            ["secondary_color", th ? "สีรอง" : "Secondary"],
            ["background_color", th ? "พื้นหลังโหมดสว่าง" : "Light background"],
            [
              "background_color_dark",
              th ? "พื้นหลังโหมดมืด" : "Dark background",
            ],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <span className="color-field">
              <input
                type="color"
                name={key}
                value={palette[key]}
                onChange={(e) =>
                  setPalette({ ...palette, [key]: e.target.value })
                }
              />
              <span>{palette[key].toUpperCase()}</span>
            </span>
          </Field>
        ))}
      </div>
    </fieldset>
  );
}
