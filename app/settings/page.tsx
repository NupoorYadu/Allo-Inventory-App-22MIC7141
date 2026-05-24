'use client';

import { useMemo } from "react";
import { Clock3, Fingerprint, Server } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { Panel, SectionTitle } from "@/components/platform-ui";

export default function SettingsPage() {
  const settings = useMemo(() => [
    { label: "Frontend polling", value: "5 seconds", tone: "success", detail: "Keeps dashboards current without extra infrastructure." },
    { label: "Reservation expiry", value: "10 minutes", tone: "warning", detail: "Matches the checkout payment window used in the app." },
    { label: "Cron cadence", value: "Every minute", tone: "success", detail: "Configured for production plans that support minute-level jobs." },
    { label: "Idempotency", value: "Enabled", tone: "success", detail: "Reservation retries replay the original response." },
  ] as const, []);

  return (
    <PlatformShell eyebrow="Settings" title="Operational settings" description="A compact view of the behaviors that keep the platform reliable in production.">
      <Panel>
        <SectionTitle eyebrow="Platform configuration" title="Runtime defaults" description="These are the assumptions the UI and backend are optimized around." />
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {settings.map((setting) => (
            <div key={setting.label} className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{setting.label}</div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{setting.value}</div>
                </div>
                <Badge variant={setting.tone === "success" ? "success" : "warning"}>{setting.tone}</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-500">{setting.detail}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <SectionTitle eyebrow="Deployment" title="Environment posture" />
          <div className="space-y-3 p-5 text-sm text-slate-600">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><Server className="h-4 w-4 text-teal-700" />Built for Vercel and a hosted Postgres provider.</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><Fingerprint className="h-4 w-4 text-blue-700" />Idempotency keys protect reservation retries.</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><Clock3 className="h-4 w-4 text-amber-700" />Reservation expiration is enforced by the scheduled cleanup route.</div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Alerts" title="What operators should watch" />
          <div className="space-y-3 p-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">Enable the simulator only on seeded stock. It creates real reservations.</div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">Leave polling on unless the backend grows realtime infrastructure.</div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">Cron should be monitored in production exactly like any other data-reclamation job.</div>
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="Notes" title="Why this UI stays compact" description="The goal is to feel like real operational software, not a generic admin template." />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[
            "Heavy animation is avoided so the dashboard feels responsive, not theatrical.",
            "The navigation surface stays consistent across all operational pages.",
            "Key risk states remain visible with concise badges and explicit action labels.",
          ].map((item) => (
            <div key={item} className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 text-sm text-slate-600">{item}</div>
          ))}
        </div>
      </Panel>
    </PlatformShell>
  );
}
