import { useEffect, useState } from "react";
import type { UserPolicy } from "@healthyscroll/shared";
import { getPolicy, setPolicy } from "../background/policyStore";

/**
 * The whole UI: one switch, one text box. Deliberately minimal.
 * The same policy can later be edited on healthyscroll.net (see docs/ROADMAP.md).
 */
export function Popup() {
  const [policy, setLocal] = useState<UserPolicy | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getPolicy().then(setLocal);
  }, []);

  if (!policy) return null;

  const save = async () => {
    const next = await setPolicy({ prompt: policy.prompt, enabled: policy.enabled });
    setLocal(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <main className="p-5 flex flex-col gap-4 bg-white text-neutral-900">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">Healthy Scroll</h1>
        <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
          {policy.enabled ? "On" : "Off"}
          <input
            type="checkbox"
            className="accent-neutral-900 h-4 w-4"
            checked={policy.enabled}
            onChange={(e) => setLocal({ ...policy, enabled: e.target.checked })}
          />
        </label>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-500">Skip anything that's…</span>
        <textarea
          className="min-h-28 resize-none rounded-lg border border-neutral-200 p-3 text-sm leading-relaxed outline-none focus:border-neutral-400"
          placeholder="e.g. gambling, drinking, thirst-trap content, anything that makes me feel worse about myself"
          value={policy.prompt}
          onChange={(e) => setLocal({ ...policy, prompt: e.target.value })}
        />
      </label>

      <button
        onClick={save}
        className="rounded-lg bg-neutral-900 text-white text-sm py-2 hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
      >
        {saved ? "Saved" : "Save"}
      </button>

      <p className="text-[11px] text-neutral-400 leading-snug">
        Video frames are analysed on your device. Only text and short captions leave your machine.
      </p>
    </main>
  );
}
