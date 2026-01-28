import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, #ede9fe 0%, #ddd6fe 30%, #c7d2fe 50%, transparent 70%)",
        }}
      />

      <div className="max-w-md text-center relative z-10">
        {/* Logo */}
        <div className="mb-12">
          <Image
            src="/apolitical-logo.png"
            alt="Apolitical"
            width={220}
            height={52}
            priority
            className="mx-auto"
          />
        </div>

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
      </div>
    </main>
  );
}
