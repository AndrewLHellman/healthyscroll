import { Wordmark } from './Wordmark'
import { PixelHeart } from './Mark'

const TEAM = [
  { name: 'Andrew Hellman', href: 'https://andrewhellman.com' },
  { name: 'Spencer Henderson', href: 'https://spencerhenderson.net' },
  { name: 'Tyler Mitts', href: 'https://tylermitts.com' },
  { name: 'Zack Murry', href: 'https://zackmurry.com' },
]

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Getting started', href: '/#getting-started' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Prompt playground', href: '/#prompts' },
      { label: 'Your week', href: '/#insights' },
      { label: 'Privacy', href: '/#faq' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Runs on',
    links: [
      { label: 'Instagram Reels (Safari)', href: '/#faq' },
      { label: 'TikTok (Chrome)', href: '/#faq' },
      { label: 'YouTube Shorts (soon)', href: '/#faq' },
    ],
  },
  {
    title: 'Built with',
    links: [
      {
        label: 'Jev by TypeSafe AI',
        href: 'https://typesafe.ai/',
      },
      { label: 'Moondream', href: 'https://moondream.ai' },
      { label: 'Vercel AI Gateway', href: 'https://vercel.com/ai-gateway' },
    ],
  },
  {
    title: 'Project',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/AndrewLHellman/healthyscroll',
      },
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
            <PixelHeart size={16} className='inline-block align-[-2px]' /> by{' '}
            {TEAM.map((m, i) => (
              <span key={m.name}>
                <a
                  href={m.href}
                  target='_blank'
                  rel='noreferrer'
                  className='rounded-md text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-ink'
                >
                  {m.name}
                </a>
                {i < TEAM.length - 2 ? ', ' : i === TEAM.length - 2 ? ', and ' : ''}
              </span>
            ))}{' '}
            for University of Missouri TigerHacks 2026.
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
          Frames are described and discarded, never stored.
        </span>
      </div>
    </footer>
  )
}
