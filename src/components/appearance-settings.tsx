"use client";
import { useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { themePresets, palettePreset, type Palette } from "@/lib/theme";
import { useLocale, useBranding } from "./providers";
import { usePersonalTheme } from "./personal-theme";
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
  const school = useBranding();
  const {
    palette: personal,
    setPalette,
    design,
    setDesign,
  } = usePersonalTheme();
  const palette = personal || school;
  const preset = palettePreset(palette);
  return (
    <section className="panel dialog-body appearance-mode">
      <div className="settings-heading">
        <h2>{locale === "th" ? "Theme ส่วนตัว" : "Personal theme"}</h2>
        <p className="hint">
          {locale === "th"
            ? "เลือก Theme หรือปรับสีเอง มีผลเฉพาะเบราว์เซอร์นี้ทันที"
            : "Choose a preset or custom colors. Changes apply to this browser immediately."}
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
      <div className="personal-theme-design">
        <h3>{locale === "th" ? "สไตล์หน้าตา" : "Design style"}</h3>
        <div className="display-modes">
          {(
            [
              ["standard", "Classic"],
              ["glass", "Glassmorphism"],
              ["neo", "Neobrutalism"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              className={`button ${design === value ? "mode-selected" : ""}`}
              key={value}
              aria-pressed={design === value}
              onClick={() => setDesign(value)}
            >
              {label}
              {design === value && <Check size={16} />}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-heading personal-theme-heading">
        <span className="badge">
          {!personal
            ? locale === "th"
              ? "ตามโรงเรียน"
              : "School default"
            : preset
              ? locale === "th"
                ? preset.th
                : preset.en
              : "Custom"}
        </span>
        <button
          type="button"
          className="button small"
          onClick={() => setPalette(null)}
        >
          {locale === "th" ? "ใช้ Theme ของโรงเรียน" : "Use school theme"}
        </button>
      </div>
      <div className="theme-presets">
        {themePresets.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`theme-preset ${personal && preset?.id === item.id ? "selected" : ""}`}
            onClick={() => setPalette(item)}
            aria-pressed={!!personal && preset?.id === item.id}
          >
            {locale === "th" ? item.th : item.en}
            {personal && preset?.id === item.id && <Check size={16} />}
          </button>
        ))}
      </div>
      <div className="form-grid">
        {(
          [
            ["primary_color", locale === "th" ? "สีหลัก" : "Primary"],
            ["secondary_color", locale === "th" ? "สีรอง" : "Secondary"],
            [
              "background_color",
              locale === "th" ? "พื้นหลังสว่าง" : "Light background",
            ],
            [
              "background_color_dark",
              locale === "th" ? "พื้นหลังมืด" : "Dark background",
            ],
          ] as const
        ).map(([key, label]) => (
          <Field label={label} key={key}>
            <span className="color-field">
              <input
                type="color"
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
      <legend>
        {th ? "Theme เริ่มต้นของโรงเรียน" : "Default school theme"}
      </legend>
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
