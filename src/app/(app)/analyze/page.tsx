"use client";

// Upload a dashcam video (plus optional GPS file), choose analysis options, then watch progress.
// Progress is simulated until the Python AI service is connected.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, CheckCircle2, Circle, CloudUpload, Copy, Film, GitCompareArrows, Layers, Loader2, MapPin, ScanSearch, Sparkles, X,
} from "lucide-react";
import { PageHeader, RoadThumb } from "@/components/ui";

const MAX_BYTES = 2 * 1024 ** 3; // 2 GB

const steps = [
  "Extracting video frames",
  "Detecting road damage",
  "Tracking and merging duplicates",
  "Comparing with past trips",
  "Generating repair report",
];

type Phase = "idle" | "processing" | "done";

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

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState({ detect: true, dedupe: true, compare: true });
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const gpsRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  // Simulated progress until the FastAPI pipeline is connected.
  useEffect(() => {
    if (phase !== "processing") return;
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 0.8 + Math.random() * 1.6);
        if (next >= 100) setPhase("done");
        return next;
      });
    }, 120);
    return () => clearInterval(t);
  }, [phase]);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) return setError("Please choose a video file (MP4, MOV or WebM).");
    if (f.size > MAX_BYTES) return setError("That file is over 2 GB. Trim it or split it into shorter clips.");
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  }

  function clear() {
    setFile(null);
    setVideoUrl(null);
    setPhase("idle");
    setProgress(0);
  }

  const options = [
    { key: "detect" as const, icon: ScanSearch, title: "Detect and track damage", text: "Find potholes, cracks and other road damage." },
    { key: "dedupe" as const, icon: Layers, title: "Remove duplicates", text: "Merge the same defect seen across many frames." },
    { key: "compare" as const, icon: GitCompareArrows, title: "Monitor changes", text: "Compare with past trips to flag worsening damage." },
  ];

  const stepIndex = Math.min(steps.length, Math.floor((progress / 100) * steps.length));
  const totalFrames = 10800;
  const frames = Math.round((progress / 100) * totalFrames);
  const found = Math.round((progress / 100) * 37);
  const dupes = Math.round((progress / 100) * 23);

  if (phase !== "idle") {
    return (
      <div>
        <PageHeader
          title={phase === "done" ? "Analysis complete" : "Analyzing video…"}
          subtitle={phase === "done" ? `${file?.name ?? "Video"} is ready to review.` : "Detecting road damage and tracking incidents."}
        />
        <div className="card mb-6 p-5">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{phase === "done" ? "Done" : steps[Math.min(stepIndex, steps.length - 1)]}</span>
            <span className="text-brand">{Math.floor(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#9d7bff] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-black">
              {videoUrl ? (
                <video src={videoUrl} className="h-full w-full object-contain" autoPlay muted loop playsInline />
              ) : (
                <RoadThumb type="pothole" className="h-full w-full" />
              )}
              {phase === "processing" && progress > 20 && (
                <div className="absolute left-[38%] top-[58%] h-[18%] w-[24%] rounded border-2 border-[#9d7bff] shadow-[0_0_0_9999px_rgba(0,0,0,0.08)]">
                  <span className="absolute -top-6 left-0 rounded bg-[#5b3fd6] px-1.5 py-0.5 text-xs font-bold text-white">Pothole 0.93</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 divide-x divide-line">
              {[
                { label: "Frames processed", value: `${frames.toLocaleString()} / ${totalFrames.toLocaleString()}`, icon: Film },
                { label: "Defects found", value: found, icon: MapPin },
                { label: "Duplicates removed", value: dupes, icon: Copy },
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
              {steps.map((s, i) => {
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
                <div className="rounded-xl bg-ok-soft p-3 text-sm text-ok">
                  <strong>14 unique incidents</strong> from 37 detections. 3 look worse than last trip.
                </div>
                <Link href="/map" className="btn-primary w-full">Review on map <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={clear} className="btn-secondary w-full">Analyze another video</button>
              </div>
            ) : (
              <button onClick={clear} className="btn-secondary mt-6 w-full">Cancel</button>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">Demo: progress is simulated. It switches to live updates once the AI service is connected.</p>
      </div>
    );
  }

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
              <p className="truncate text-xs text-muted">{gps ? gps.name : "Add a GPX or NMEA file so each defect gets a map location."}</p>
            </div>
            <button onClick={() => gpsRef.current?.click()} className="btn-secondary text-sm">{gps ? "Change" : "Add GPS file"}</button>
            <input ref={gpsRef} type="file" accept=".gpx,.nmea,.csv,.txt" className="hidden" onChange={(e) => setGps(e.target.files?.[0] ?? null)} />
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
          <button
            disabled={!file || !opts.detect}
            onClick={() => { setProgress(0); setPhase("processing"); }}
            className="btn-primary mt-6 w-full py-3"
          >
            <Sparkles className="h-4 w-4" /> Analyze video
          </button>
          {!file && (
            <button onClick={() => { setProgress(0); setPhase("processing"); }} className="mt-2 w-full text-center text-sm font-semibold text-brand hover:underline">
              No video handy? Run the sample
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
