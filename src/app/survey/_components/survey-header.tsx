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
          width={120}
          height={28}
          priority
        />
      </div>
    </header>
  );
}
