import { Wordmark } from './Wordmark'
import { PixelHeart } from './Mark'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Prompt playground', href: '#prompts' },
      { label: 'Your week', href: '#insights' },
      { label: 'Privacy', href: '#faq' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Runs on',
    links: [
      { label: 'TikTok (web)', href: '#faq' },
      { label: 'Instagram Reels — soon', href: '#faq' },
      { label: 'YouTube Shorts — soon', href: '#faq' },
    ],
  },
  {
    title: 'Built with',
    links: [
      {
        label: 'Jev by TypeSafe AI',
        href: 'https://vercel.com/ai-gateway/models/jev',
      },
      { label: 'Moondream', href: 'https://moondream.ai' },
      { label: 'Vercel AI Gateway', href: 'https://vercel.com/ai-gateway' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'TigerHacks 2026', href: '#' },
    ],
  },
]

export function Footer() {
  return (
    <footer className='border-t border-line'>
      <div className='mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]'>
        <div className='flex flex-col gap-3'>
          <Wordmark />
          <p className='max-w-xs text-sm leading-relaxed text-muted'>
            Built with{' '}
            <PixelHeart size={16} className='inline-block align-[-2px]' /> by
            Andrew Hellman, Spencer Henderson, Tyler Mitts, and Zack Murry for
            University of Missouri TigerHacks 2026.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className='text-xs font-medium uppercase tracking-wider text-faint'>
              {col.title}
            </p>
            <ul className='mt-3 flex flex-col gap-2 text-sm'>
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className='rounded-md text-muted transition-colors hover:text-ink'
                    {...(l.href.startsWith('http')
                      ? { target: '_blank', rel: 'noreferrer' }
                      : {})}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className='mx-auto flex max-w-6xl flex-col gap-2 border-t border-line px-5 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8'>
        <span>© 2026 Healthy Scroll. Open source.</span>
        <span>
          Video frames are analysed on your device and never uploaded.
        </span>
      </div>
    </footer>
  )
}
