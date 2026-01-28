import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header - matches survey pages */}
      <header className="sticky top-0 z-50 bg-white">
        <div className="px-6 sm:px-8 py-1.5">
          <Image
            src="/apolitical-logo.png"
            alt="Apolitical"
            width={200}
            height={47}
            priority
          />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 relative overflow-hidden" style={{ minHeight: "calc(100vh - 60px)" }}>
        {/* Subtle gradient accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, #ede9fe 0%, #ddd6fe 30%, #c7d2fe 50%, transparent 70%)",
          }}
        />

        <div className="max-w-md text-center relative z-10">
          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
            The world of work is changing.
          </h1>

          <p className="mt-4 text-neutral-500 text-lg">
            Tell us about your role and we&apos;ll help personalise your learning and show how your work may evolve.
          </p>

          {/* CTA */}
          <Link
            href="/survey"
            className="mt-10 inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            Get started
            <ArrowRight className="h-5 w-5" />
          </Link>

          {/* Time estimate */}
          <p className="mt-8 text-sm text-neutral-400">
            Takes about 5 minutes
          </p>

          {/* Skip to leader view */}
          <div className="mt-12 pt-8 border-t border-neutral-200">
            <p className="text-xs text-neutral-400 mb-2">Demo: See what leaders see</p>
            <Link
              href="/leader"
              className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 transition-colors"
            >
              Skip to aggregate dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
