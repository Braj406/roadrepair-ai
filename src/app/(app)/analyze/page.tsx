"use client";

// Upload a dashcam video (plus optional GPS file), choose analysis options, then watch progress.
// When the Python AI service is running, the video is analyzed for real and the results are
// saved to Supabase. Otherwise "Run the sample" plays a simulated run for demos.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, Circle, CloudUpload, Copy, Cpu, Film, GitCompareArrows, Layers, Loader2, MapPin,
  RefreshCw, ScanSearch, Sparkles, X,
} from "lucide-react";
import { PageHeader, RoadThumb, SeverityBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DAMAGE_LABEL } from "@/lib/data";
import { checkService, getJob, startJob, type AiJob, type ServiceStatus } from "@/lib/aiService";
import { saveScan, type SaveSummary } from "@/lib/saveScan";

const MAX_BYTES = 2 * 1024 ** 3; // 2 GB
const POLL_MS = 600;

const STEPS = [
  "Extracting video frames",
  "Detecting road damage",
  "Tracking and merging duplicates",
  "Comparing with past trips",
  "Generating repair report",
];

type Phase = "idle" | "processing" | "done" | "failed";
type SaveState = { state: "idle" | "saving" | "saved" | "error" | "skipped"; summary?: SaveSummary; error?: string };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function formatTime(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Shows whether the AI service is reachable, and what to do if it isn't.
function ServiceBadge({ status, onRetry }: { status: ServiceStatus | null; onRetry: () => void }) {
  if (!status) {
    return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking AI service…</p>;
  }
  if (status.state === "ready") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-ok-soft px-3 py-2 text-xs font-semibold text-ok">
        <Cpu className="h-3.5 w-3.5" /> AI service ready ({status.device.toUpperCase()})
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-medium-soft px-3 py-2 text-xs text-medium">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">{status.state === "offline" ? "AI service is not running" : "AI model not installed"}</p>
        <p>See ai-service/README.md. You can still run the sample.</p>
      </div>
      <button onClick={onRetry} className="rounded p-1 hover:bg-white/40" aria-label="Check again"><RefreshCw className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export default function AnalyzePage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState({ detect: true, dedupe: true, compare: true });
  const [service, setService] = useState<ServiceStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [demo, setDemo] = useState(false); // simulated run
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AiJob | null>(null);
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const gpsRef = useRef<HTMLInputElement>(null);

  const refreshService = useCallback(() => {
    setService(null);
    checkService().then(setService);
  }, []);

  useEffect(() => {
    checkService().then(setService);
  }, []);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  // Simulated progress for the sample run.
  useEffect(() => {
    if (phase !== "processing" || !demo) return;
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 0.8 + Math.random() * 1.6);
        if (next >= 100) setPhase("done");
        return next;
      });
    }, 120);
    return () => clearInterval(t);
  }, [phase, demo]);

  // Poll the AI service while a real job runs.
  useEffect(() => {
    if (!jobId || phase !== "processing" || demo) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await getJob(jobId);
        if (stopped) return;
        setJob((prev) => ({ ...next, preview: next.preview ?? prev?.preview }));
        setProgress(next.progress);
        if (next.status === "completed") setPhase("done");
        else if (next.status === "failed") { setError(next.error ?? "Analysis failed."); setPhase("failed"); }
        else timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!stopped) { setError((e as Error).message); setPhase("failed"); }
      }
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [jobId, phase, demo]);

  // Save real results to Supabase once, when the job finishes.
  useEffect(() => {
    if (phase !== "done" || demo || !job?.result || save.state !== "idle") return;
    if (!supabase || !user) {
      Promise.resolve().then(() => setSave({ state: "skipped" }));
      return;
    }
    Promise.resolve().then(() => setSave({ state: "saving" }));
    saveScan(job.result, file?.name ?? job.filename, user.id, opts.compare)
      .then((summary) => setSave({ state: "saved", summary }))
      .catch((e: Error) => setSave({ state: "error", error: e.message }));
  }, [phase, demo, job, save.state, user, file, opts.compare]);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) return setError("Please choose a video file (MP4, MOV or WebM).");
    if (f.size > MAX_BYTES) return setError("That file is over 2 GB. Trim it or split it into shorter clips.");
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  }

  function reset() {
    setPhase("idle");
    setDemo(false);
    setProgress(0);
    setJobId(null);
    setJob(null);
    setSave({ state: "idle" });
    setError(null);
  }

  function clear() {
    reset();
    setFile(null);
    setVideoUrl(null);
    setGps(null);
  }

  async function analyze() {
    if (!file) return;
    reset();
    setPhase("processing");
    try {
      setJobId(await startJob(file, gps, opts.dedupe));
    } catch (e) {
      setError((e as Error).message);
      setPhase("failed");
    }
  }

  function runSample() {
    reset();
    setDemo(true);
    setPhase("processing");
  }

  const options = [
    { key: "detect" as const, icon: ScanSearch, title: "Detect and track damage", text: "Find potholes, cracks and other road damage." },
    { key: "dedupe" as const, icon: Layers, title: "Remove duplicates", text: "Merge the same defect seen across many frames." },
    { key: "compare" as const, icon: GitCompareArrows, title: "Monitor changes", text: "Match against past trips to flag worsening damage." },
  ];

  // ---- Processing / results view ----
  if (phase !== "idle") {
    const result = job?.result;
    const stepIndex = demo
      ? Math.min(STEPS.length, Math.floor((progress / 100) * STEPS.length))
      : phase === "done" ? STEPS.length : (job?.step ?? 0);
    const framesTotal = demo ? 10800 : job?.frames_total ?? 0;
    const framesDone = demo ? Math.round((progress / 100) * framesTotal) : job?.frames_done ?? 0;
    const detections = demo ? Math.round((progress / 100) * 37) : job?.detections ?? 0;
    const unique = demo ? Math.round((progress / 100) * 14) : result?.incidents.length ?? job?.unique ?? 0;
    const duplicates = Math.max(0, detections - unique);

    return (
      <div>
        <PageHeader
          title={phase === "done" ? "Analysis complete" : phase === "failed" ? "Analysis stopped" : "Analyzing video…"}
          subtitle={phase === "done" ? `${file?.name ?? "Sample video"} is ready to review.` : phase === "failed" ? "Something went wrong." : "Detecting road damage and tracking incidents."}
        />

        <div className="card mb-6 p-5">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{phase === "done" ? "Done" : phase === "failed" ? "Stopped" : job?.status === "queued" || (!demo && !job) ? "Uploading…" : STEPS[Math.min(stepIndex, STEPS.length - 1)]}</span>
            <span className="text-brand">{Math.floor(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#9d7bff] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && <p role="alert" className="mb-6 rounded-xl bg-high-soft px-4 py-3 text-sm text-high">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-black">
              {job?.preview && phase === "processing" ? (
                // eslint-disable-next-line @next/next/no-img-element -- live frame from the AI service (data URL)
                <img src={job.preview} alt="Frame the AI is analyzing" className="h-full w-full object-contain" />
              ) : videoUrl && !demo ? (
                <video src={videoUrl} className="h-full w-full object-contain" autoPlay muted loop playsInline />
              ) : (
                <RoadThumb type="pothole" className="h-full w-full" />
              )}
              {demo && phase === "processing" && progress > 20 && (
                <div className="absolute left-[38%] top-[58%] h-[18%] w-[24%] rounded border-2 border-[#9d7bff]">
                  <span className="absolute -top-6 left-0 rounded bg-[#5b3fd6] px-1.5 py-0.5 text-xs font-bold text-white">Pothole 0.93</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 divide-x divide-line">
              {[
                { label: "Frames processed", value: framesTotal ? `${framesDone.toLocaleString()} / ${framesTotal.toLocaleString()}` : "…", icon: Film },
                { label: "Defects found", value: unique, icon: MapPin },
                { label: "Duplicates removed", value: duplicates, icon: Copy },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-4">
                  <Icon className="hidden h-5 w-5 text-brand sm:block" />
                  <div>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="font-bold">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-bold">Pipeline</h2>
            <ol className="space-y-3">
              {STEPS.map((s, i) => {
                const done = phase === "done" || i < stepIndex;
                const active = phase === "processing" && i === stepIndex;
                return (
                  <li key={s} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${active ? "bg-brand-soft" : ""}`}>
                    {done ? <CheckCircle2 className="h-5 w-5 text-ok" /> : active ? <Loader2 className="h-5 w-5 animate-spin text-brand" /> : <Circle className="h-5 w-5 text-line" />}
                    <span className={`text-sm ${done || active ? "font-semibold" : "text-muted"}`}>{s}</span>
                  </li>
                );
              })}
            </ol>

            {phase === "done" ? (
              <div className="mt-6 space-y-2">
                {demo ? (
                  <div className="rounded-xl bg-ok-soft p-3 text-sm text-ok">
                    <strong>14 unique incidents</strong> from 37 detections. 3 look worse than last trip. (Sample run)
                  </div>
                ) : (
                  <SaveStatus save={save} found={result?.incidents.length ?? 0} hasGps={!!result?.has_gps} />
                )}
                <Link href="/map" className="btn-primary w-full">Review on map <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={reset} className="btn-secondary w-full">Analyze another video</button>
              </div>
            ) : phase === "failed" ? (
              <button onClick={reset} className="btn-secondary mt-6 w-full">Back</button>
            ) : (
              <button onClick={reset} className="btn-secondary mt-6 w-full">{demo ? "Cancel" : "Hide (keeps running)"}</button>
            )}
          </div>
        </div>

        {result && result.incidents.length > 0 && (
          <section className="card mt-6 p-5">
            <h2 className="mb-4 font-bold">Found in this video</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.incidents.map((inc, n) => (
                <li key={n} className="flex gap-3 rounded-xl border border-line p-3">
                  {inc.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- crop from the AI service (data URL)
                    <img src={inc.thumbnail} alt={DAMAGE_LABEL[inc.type]} className="h-20 w-24 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <RoadThumb type={inc.type} className="h-20 w-24 shrink-0 rounded-lg" />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{DAMAGE_LABEL[inc.type]}</p>
                    <SeverityBadge severity={inc.severity} />
                    <p className="mt-1 text-xs text-muted">
                      {Math.round(inc.confidence * 100)}% sure · at {formatTime(inc.video_time)} · {inc.frames_seen} frames
                    </p>
                    <p className="text-xs text-muted">{inc.lat !== null ? `${inc.lat.toFixed(5)}, ${inc.lng!.toFixed(5)}` : "No GPS"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {demo && <p className="mt-4 text-xs text-muted">Sample run: progress and results are simulated.</p>}
      </div>
    );
  }

  // ---- Upload view ----
  const serviceReady = service?.state === "ready";
  return (
    <div>
      <PageHeader title="Upload & analyze" subtitle="Upload dashcam video and let AI find the road damage." />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {file && videoUrl ? (
            <div className="card overflow-hidden">
              <video src={videoUrl} controls className="aspect-video w-full bg-black" />
              <div className="flex items-center gap-3 p-4">
                <Film className="h-5 w-5 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1024 ** 2).toFixed(1)} MB</p>
                </div>
                <button onClick={clear} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2" aria-label="Remove video">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
              className={`flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-brand bg-brand-soft" : "border-brand/30 bg-surface hover:bg-surface-2"}`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
                <CloudUpload className="h-8 w-8 text-brand" />
              </div>
              <p className="text-lg font-bold">Drag and drop a dashcam video</p>
              <p className="text-sm text-muted">or <span className="font-semibold text-brand">click to browse</span></p>
              <p className="mt-3 text-xs text-muted">MP4, MOV or WebM · up to 2 GB</p>
            </button>
          )}
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {error && <p role="alert" className="rounded-xl bg-high-soft px-4 py-3 text-sm text-high">{error}</p>}

          <div className="card flex flex-wrap items-center gap-3 p-4">
            <MapPin className="h-5 w-5 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">GPS track <span className="font-normal text-muted">(optional)</span></p>
              <p className="truncate text-xs text-muted">{gps ? gps.name : "Add a GPX file (or CSV: seconds, lat, lng) so each defect gets a map location."}</p>
            </div>
            {gps && (
              <button onClick={() => setGps(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2" aria-label="Remove GPS file">
                <X className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => gpsRef.current?.click()} className="btn-secondary text-sm">{gps ? "Change" : "Add GPS file"}</button>
            <input ref={gpsRef} type="file" accept=".gpx,.csv" className="hidden" onChange={(e) => setGps(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-bold">Analysis options</h2>
          <ul className="space-y-3">
            {options.map(({ key, icon: Icon, title, text }) => (
              <li key={key} className="flex items-start gap-3 rounded-xl border border-line p-3">
                <Icon className="mt-0.5 h-5 w-5 text-brand" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted">{text}</p>
                </div>
                <Toggle label={title} on={opts[key]} onChange={(v) => setOpts((o) => ({ ...o, [key]: v }))} />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <ServiceBadge status={service} onRetry={refreshService} />
          </div>
          <button disabled={!file || !opts.detect || !serviceReady} onClick={analyze} className="btn-primary mt-4 w-full py-3">
            <Sparkles className="h-4 w-4" /> Analyze video
          </button>
          <button onClick={runSample} className="mt-2 w-full text-center text-sm font-semibold text-brand hover:underline">
            No video or service? Run the sample
          </button>
        </div>
      </div>
    </div>
  );
}

// Result of saving to Supabase, shown when a real analysis finishes.
function SaveStatus({ save, found, hasGps }: { save: SaveState; found: number; hasGps: boolean }) {
  if (save.state === "saving") {
    return <div className="flex items-center gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand"><Loader2 className="h-4 w-4 animate-spin" /> Saving {found} incidents…</div>;
  }
  if (save.state === "error") {
    return <div className="rounded-xl bg-high-soft p-3 text-sm text-high">Analysis worked, but saving failed: {save.error}</div>;
  }
  if (save.state === "skipped") {
    return <div className="rounded-xl bg-medium-soft p-3 text-sm text-medium"><strong>{found} incidents found.</strong> Not saved: connect Supabase to keep results.</div>;
  }
  const s = save.summary;
  return (
    <div className="rounded-xl bg-ok-soft p-3 text-sm text-ok">
      <strong>{found} incidents found and saved.</strong>
      {s && s.updated > 0 && <> {s.updated} matched earlier trips{s.worsened > 0 ? `, ${s.worsened} look worse` : ""}.</>}
      {!hasGps && <span className="block text-xs">No GPS file, so they won&apos;t appear on the map.</span>}
    </div>
  );
}
