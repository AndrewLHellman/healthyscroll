import { Wordmark } from "./Wordmark";
import { AuthButton } from "@/app/AuthButton";

const LINKS = [
  { href: "#getting-started", label: "Getting started" },
  { href: "#prompts", label: "Prompts" },
  { href: "#insights", label: "Your week" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8" aria-label="Main">
        <a href="#" className="flex items-center gap-2 rounded-md">
          <Wordmark />
        </a>
        <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-md transition-colors hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-5">
          <AuthButton />
          <a
            href="#install"
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
          >
            Get it for iPhone
          </a>
        </div>
      </nav>
    </header>
  );
}
