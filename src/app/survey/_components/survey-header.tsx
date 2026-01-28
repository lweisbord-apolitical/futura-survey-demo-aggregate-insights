"use client";

import Image from "next/image";

export function SurveyHeader() {
  return (
    <header className="border-b border-neutral-100">
      <div className="px-6 sm:px-8 py-4">
        {/* Logo */}
        <Image
          src="/apolitical-logo.png"
          alt="Apolitical"
          width={180}
          height={42}
          priority
        />
      </div>
    </header>
  );
}
