/**
 * A faithful, static rendering of the extension popup — the entire UI.
 * Mirrors apps/extension/src/popup/Popup.tsx; if that changes, change this.
 */
import { Mark } from "./Mark";

export function PopupMock() {
  return (
    <div className="relative">
      {/* Browser toolbar fragment, so it reads as a popup and not a form. */}
      <div className="flex items-center justify-end gap-3 rounded-t-xl border border-b-0 border-line bg-mist px-3 py-2">
        <span className="h-2 w-24 rounded-full bg-line" aria-hidden />
        <Mark height={14} className="text-ink" />
      </div>

      <div className="w-[320px] rounded-b-xl border border-line bg-paper p-5 shadow-[0_24px_60px_-24px_rgba(18,20,26,0.35)]">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold tracking-tight">Healthy Scroll</p>
          <span className="flex items-center gap-2 text-xs text-muted">
            On
            <span className="grid h-4 w-4 place-items-center rounded-sm bg-ink text-[10px] text-paper" aria-hidden>
              ✓
            </span>
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <p className="text-xs text-muted">Skip anything that’s…</p>
          <div className="min-h-28 rounded-lg border border-line p-3 text-sm leading-relaxed">
            gambling, drinking, thirst-trap content, anything that makes me feel worse about myself
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-ink py-2 text-center text-sm text-paper">Save</div>

        {/* The one line of observability in the popup. Links to the full week. */}
        <p className="mt-4 flex items-baseline justify-between border-t border-line pt-3 font-mono text-[11px] text-muted">
          <span>
            today · 22m · 8 skipped · mostly <span className="text-ink">comedy</span>
          </span>
          <span aria-hidden>→</span>
        </p>

        <p className="mt-3 text-[11px] leading-snug text-faint">
          Video frames are analysed on your device. Only text leaves your machine. Your tally stays in this browser.
        </p>
      </div>
    </div>
  );
}
