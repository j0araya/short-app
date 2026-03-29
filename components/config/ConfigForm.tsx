"use client";

import { useState } from "react";
import type { ProjectConfig } from "@/lib/config/schema";

// ── Primitive UI components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[var(--color-muted)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--color-muted)] opacity-70">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors";

const selectClass = inputClass;

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className={inputClass}
    />
  );
}

// Tags input — comma-separated display, stored as string[]
function TagsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState(value.join(", "));

  function handleBlur() {
    const parsed = input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onChange(parsed);
    setInput(parsed.join(", "));
  }

  return (
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onBlur={handleBlur}
      placeholder="tag1, tag2, tag3"
      className={inputClass}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type FormState = Omit<ProjectConfig, "sources" | "platforms">;

export function ConfigForm({ initial }: { initial: ProjectConfig }) {
  const [form, setForm] = useState<FormState>({
    name: initial.name,
    niche: initial.niche,
    hn: { ...initial.hn },
    schedule: { ...initial.schedule },
    video: { ...initial.video },
    youtube: { ...initial.youtube },
  });

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ? JSON.stringify(data.error) : "Save failed");
        return;
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── General ────────────────────────────────────────────────────── */}
      <Section title="General">
        <Field label="Project name">
          <TextInput value={form.name} onChange={(v) => patch("name", v)} />
        </Field>
        <Field label="Niche" hint="Used for DB tagging and future filtering">
          <TextInput value={form.niche} onChange={(v) => patch("niche", v)} placeholder="tech-news" />
        </Field>
      </Section>

      {/* ── Sources ────────────────────────────────────────────────────── */}
      <Section title="Sources">
        <Field label="HN feed">
          <SelectInput
            value={form.hn.feed}
            onChange={(v) =>
              patch("hn", { ...form.hn, feed: v as ProjectConfig["hn"]["feed"] })
            }
            options={[
              { value: "topstories", label: "Top Stories" },
              { value: "newstories", label: "New Stories" },
              { value: "beststories", label: "Best Stories" },
            ]}
          />
        </Field>
        <Field label="Stories per run" hint="1–30">
          <NumberInput
            value={form.hn.limit}
            onChange={(v) => patch("hn", { ...form.hn, limit: v })}
            min={1}
            max={30}
          />
        </Field>
      </Section>

      {/* ── Schedule ───────────────────────────────────────────────────── */}
      <Section title="Schedule">
        <Field label="Run frequency">
          <SelectInput
            value={form.schedule.frequency}
            onChange={(v) =>
              patch("schedule", {
                frequency: v as ProjectConfig["schedule"]["frequency"],
              })
            }
            options={[
              { value: "30m", label: "Every 30 minutes" },
              { value: "1h", label: "Every hour" },
              { value: "2h", label: "Every 2 hours" },
              { value: "6h", label: "Every 6 hours" },
              { value: "12h", label: "Every 12 hours" },
              { value: "24h", label: "Once a day" },
            ]}
          />
        </Field>
      </Section>

      {/* ── Video ──────────────────────────────────────────────────────── */}
      <Section title="Video">
        <Field label="Duration (seconds)" hint="15–60 seconds for Shorts">
          <NumberInput
            value={form.video.durationSeconds}
            onChange={(v) => patch("video", { ...form.video, durationSeconds: v })}
            min={15}
            max={60}
          />
        </Field>
        <Field label="TTS engine">
          <SelectInput
            value={form.video.tts}
            onChange={(v) =>
              patch("video", { ...form.video, tts: v as ProjectConfig["video"]["tts"] })
            }
            options={[
              { value: "gtts", label: "gTTS (free)" },
              { value: "elevenlabs", label: "ElevenLabs (requires API key)" },
            ]}
          />
        </Field>
      </Section>

      {/* ── YouTube ────────────────────────────────────────────────────── */}
      <Section title="YouTube">
        <Field label="Privacy status">
          <SelectInput
            value={form.youtube.privacyStatus}
            onChange={(v) =>
              patch("youtube", {
                ...form.youtube,
                privacyStatus: v as ProjectConfig["youtube"]["privacyStatus"],
              })
            }
            options={[
              { value: "public", label: "Public" },
              { value: "unlisted", label: "Unlisted" },
              { value: "private", label: "Private" },
            ]}
          />
        </Field>
        <Field label="Category ID" hint="28 = Science & Technology, 24 = Entertainment">
          <TextInput
            value={form.youtube.categoryId}
            onChange={(v) => patch("youtube", { ...form.youtube, categoryId: v })}
            placeholder="28"
          />
        </Field>
        <Field label="Tags" hint="Comma-separated">
          <TagsInput
            value={form.youtube.tags}
            onChange={(v) => patch("youtube", { ...form.youtube, tags: v })}
          />
        </Field>
        <Field label="Description template" hint="{title} is replaced with the video title">
          <TextInput
            value={form.youtube.descriptionTemplate}
            onChange={(v) => patch("youtube", { ...form.youtube, descriptionTemplate: v })}
            placeholder="{title} #Shorts"
          />
        </Field>
      </Section>

      {/* ── Save ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="px-5 py-2 rounded text-sm font-medium text-white cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>

        {status === "saved" && (
          <span className="text-sm" style={{ color: "var(--color-success)" }}>
            Saved — takes effect on next run
          </span>
        )}
        {status === "error" && (
          <span className="text-sm" style={{ color: "var(--color-error)" }}>
            {errorMsg ?? "Error saving config"}
          </span>
        )}
      </div>
    </div>
  );
}
