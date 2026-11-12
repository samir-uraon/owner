export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafaff] px-6">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes glow {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 8px 20px rgba(124, 58, 237, 0.15); }
          50% { box-shadow: 0 8px 30px rgba(124, 58, 237, 0.3); }
        }

        .error-number { animation: float 4s ease-in-out infinite; }
        .error-glow { animation: glow 4s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.8s ease-out both; }
        .fade-up-1 { animation-delay: 0.15s; }
        .fade-up-2 { animation-delay: 0.3s; }
        .fade-up-3 { animation-delay: 0.45s; }
        .home-button { animation: buttonPulse 3s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* Background decorations */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="relative w-full max-w-md text-center">
        {/* 404 */}
        <div className="relative mx-auto mb-6 flex h-40 w-64 items-center justify-center">
          <div className="error-glow absolute h-36 w-36 rounded-full bg-violet-300/40 blur-3xl" />

          <span className="error-number relative text-8xl font-black tracking-tighter text-violet-600">
            404
          </span>
        </div>

        <p className="fade-up mb-3 text-xs font-bold uppercase tracking-[0.25em] text-violet-600">
          Error 404
        </p>

        <h1 className="fade-up fade-up-1 text-3xl font-bold tracking-tight text-gray-900">
          Lost your way?
        </h1>

        <p className="fade-up fade-up-2 mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-500">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back on track.
        </p>

        <div className="fade-up fade-up-3 mt-8">
          <a
            href="/"
            className="home-button inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-violet-700 hover:shadow-xl"
          >
            <span>Go to Homepage</span>
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        </div>
      </div>
    </main>
  );
}