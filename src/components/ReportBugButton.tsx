import { useState } from 'react';
import { reportBug } from '../utils/reportBug';

export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    await reportBug(description.trim(), window.location.href);
    setSubmitted(true);
    setDescription('');
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
    }, 3000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-taupe hover:text-cream transition-colors"
      >
        Report a Bug
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-surface2 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-cream text-sm font-semibold mb-3">Report a Bug</h2>

            {submitted ? (
              <p className="text-powder text-sm text-center py-4">Thanks, bug reported!</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what went wrong..."
                  rows={4}
                  className="bg-surface text-cream text-sm rounded-lg p-3 resize-none outline-none focus:ring-1 focus:ring-steel placeholder:text-taupe"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-taupe text-sm px-3 py-1.5 rounded-lg hover:text-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-steel text-base text-sm px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Submit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
