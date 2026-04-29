type Props = {
  onGetStarted: () => void
  onDismiss: () => void
}

const steps = [
  {
    num: "1",
    title: "Search",
    desc: "Find any album by name or artist",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    num: "2",
    title: "Compare",
    desc: "Pick your favorite in head-to-head matchups",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  },
  {
    num: "3",
    title: "Ranked",
    desc: "Your personal list, refined over time",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
]

export default function OnboardingModal({ onGetStarted, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-enter"
      onClick={onDismiss}
    >
      <div
        className="bg-surface w-full max-w-sm rounded-2xl p-6 flex flex-col gap-6 modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-cream text-lg font-semibold">Welcome to Album Ranker</h2>
          <p className="text-taupe/60 text-sm">Here's how it works</p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-4">
          {steps.map(step => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-steel/15 text-steel flex items-center justify-center">
                {step.icon}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-cream text-sm font-medium">{step.title}</span>
                <span className="text-taupe/60 text-xs">{step.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onGetStarted}
            className="w-full py-2.5 rounded-xl bg-steel text-white text-sm font-medium hover:bg-powder active:scale-95 transition-all"
          >
            Get Started
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-taupe/40 hover:text-taupe/60 transition-colors text-center py-1"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
