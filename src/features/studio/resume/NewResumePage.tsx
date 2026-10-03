import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Badge } from "@/components/ui/misc";
import { createResumeSection } from "@/studio/model/defaults";
import { ensureSectionsFor } from "@/studio/import/resume-json";
import { getPersona, SAMPLE_PERSONAS } from "@/studio/model/sample";
import { ensureWorkspace, useWorkspace } from "@/studio/store/workspace";
import { RESUME_TEMPLATES, getResumeTemplate } from "@/studio/templates/resume";
import {
  applyImport,
  JsonImportBox,
  type ImportChoice,
} from "../shared/JsonImportBox";
import { ResumeThumb } from "./ResumeThumb";
import {
  newResumeFor,
  useCreateResume,
  useProfileIsEmpty,
} from "./useCreateResume";
import { cn } from "@/utils/cn";

const PRESET_NAMES = [
  "My Resume",
  "Frontend Resume",
  "Backend Resume",
  "Full Stack Resume",
  "Academic CV",
];
const FILTERS = [
  "All",
  "New",
  "Premium",
  "ATS",
  "Two column",
  "Photo",
  "Serif",
] as const;

export default function NewResumePage() {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const canUseSample = useProfileIsEmpty();
  const create = useCreateResume();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(PRESET_NAMES[0]!);
  const [templateId, setTemplateId] = useState(RESUME_TEMPLATES[0]!.id);
  const [sample, setSample] = useState(true);
  const [personaId, setPersonaId] = useState<string>("auto");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [imported, setImported] = useState<ImportChoice | null>(null);
  const useSample = canUseSample && sample && !imported;

  useEffect(() => {
    void ensureWorkspace().then(() => setReady(true));
  }, []);

  const submit = async (id = templateId) => {
    if (busy) return;
    setBusy(true);
    try {
      await create({
        name: name.trim() || "My Resume",
        templateId: id,
        sample: useSample,
        ...(personaId !== "auto" ? { personaId } : {}),
        ...(imported ? { imported } : {}),
      });
    } finally {
      setBusy(false);
    }
  };

  const list = RESUME_TEMPLATES.filter((t) => {
    if (filter === "All") return true;
    if (filter === "New") return !!t.isNew;
    if (filter === "ATS") return t.ats === "high";
    if (filter === "Two column") return t.columns === 2;
    if (filter === "Photo") return t.supportsPhoto;
    return t.tags.includes(filter);
  });
  // Thumbnails show the user's own content, or each template's example persona when there is none yet.
  const previews = useMemo(() => {
    if (!ready) return [];
    const fromFile = imported ? applyImport(profile, library, imported) : null;
    return RESUME_TEMPLATES.map((t) => {
      if (fromFile && imported) {
        const r = ensureSectionsFor(
          newResumeFor(t, "Preview", imported.data.entries),
          fromFile.library,
          imported.data.entries,
          (kind, title) => createResumeSection(kind, title ? { title } : {}),
        );
        return {
          t,
          resume: r,
          profile: fromFile.profile,
          library: fromFile.library,
        };
      }
      const persona = getPersona(
        personaId === "auto" ? t.starter?.persona : personaId,
      );
      return {
        t,
        resume: newResumeFor(t, "Preview", canUseSample ? persona.entries : {}),
        profile: canUseSample ? persona.profile() : profile,
        library: canUseSample ? persona.library() : library,
      };
    });
  }, [ready, personaId, canUseSample, profile, library, imported]);
  const selected = getResumeTemplate(templateId);

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-8 sm:px-6 sm:pt-10"
      >
        <Link
          to="/resumes"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" /> All resumes
        </Link>
        <header className="mt-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">
            Resume Studio
          </p>
          <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
            New resume
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">
            Pick a template. You can switch at any time without losing content.
          </p>
        </header>

        <section aria-label="Resume details" className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="resume-names"
            />
            {canUseSample && !imported && (
              <label className="block">
                <span className="app-label">Example content</span>
                <select
                  className="app-input h-9 w-full"
                  value={useSample ? personaId : "none"}
                  onChange={(e) =>
                    e.target.value === "none"
                      ? setSample(false)
                      : (setSample(true), setPersonaId(e.target.value))
                  }
                >
                  <option value="auto">Matched to each template</option>
                  {SAMPLE_PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="none">Start empty</option>
                </select>
              </label>
            )}
          </div>
          <datalist id="resume-names">
            {PRESET_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <JsonImportBox
            value={imported}
            canReplace={!canUseSample}
            defaultMode={canUseSample ? "replace" : "merge"}
            samplePersona={selected.starter?.persona ?? "engineer-lead"}
            onChange={(next) => {
              setImported(next);
              const n = next?.data.profile.name;
              if (n && (!name.trim() || PRESET_NAMES.includes(name)))
                setName(`${n} Resume`);
            }}
          />
          {useSample && (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[12px] text-fg-muted">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Your resume starts fully filled in with a fictional example:
              summary, roles, achievements, skills, education and languages.
              Click any part of the page to edit it. It all goes into your
              shared profile, so replace it with your own details.
            </p>
          )}
        </section>

        <section aria-labelledby="templates-heading" className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="templates-heading" className="text-[15px] font-semibold">
              Templates{" "}
              <span className="font-normal text-fg-subtle">
                · {list.length}
              </span>
            </h2>
            <div
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
              role="tablist"
              aria-label="Filter templates"
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[12px]",
                    filter === f
                      ? "border-accent bg-accent-soft text-fg"
                      : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ul
            className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-5"
            role="listbox"
            aria-label="Templates"
          >
            {list.map((t) => {
              const p = previews.find((x) => x.t.id === t.id);
              const active = t.id === templateId;
              return (
                <li key={t.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    onDoubleClick={() => void submit(t.id)}
                    className={cn(
                      "group w-full rounded-2xl border p-3 text-left transition",
                      active
                        ? "border-accent bg-accent-soft/50 ring-2 ring-accent/30"
                        : "border-line bg-panel hover:border-line-strong",
                    )}
                  >
                    <div className="relative grid place-items-center rounded-xl bg-canvas p-3">
                      {p ? (
                        <ResumeThumb
                          resume={p.resume}
                          library={p.library}
                          profile={p.profile}
                          width={180}
                          className="transition group-hover:-translate-y-0.5"
                        />
                      ) : (
                        <div className="aspect-[210/297] w-[180px] max-w-full rounded bg-white/90" />
                      )}
                      {active && (
                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-accent-fg">
                          <Check className="size-3" /> Selected
                        </span>
                      )}
                      {t.isNew && (
                        <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                          New
                        </span>
                      )}
                    </div>
                    <span className="mt-2.5 block text-[13.5px] font-semibold">
                      {t.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-fg-subtle">
                      {t.description}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {t.ats === "high" && (
                        <Badge tone="ok">
                          <ShieldCheck className="size-3" /> ATS
                        </Badge>
                      )}
                      {t.columns === 2 && <Badge>Two column</Badge>}
                      {t.supportsPhoto && <Badge>Photo</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <div className="sticky bottom-0 z-30 border-t border-line/70 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="mr-auto min-w-0 truncate text-[12.5px] text-fg-subtle">
            Template: <strong className="text-fg">{selected.name}</strong>
            <span className="hidden sm:inline">
              {useSample && <> · with example content</>}
              {imported && <> · values from {imported.fileName}</>}
            </span>
          </span>
          <Link
            to="/resumes"
            className="hidden h-9 items-center rounded-lg px-3.5 text-[13px] text-fg-muted hover:bg-hover hover:text-fg sm:inline-flex"
          >
            Cancel
          </Link>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void submit()}
          >
            Create resume
          </Button>
        </div>
      </div>
    </div>
  );
}
