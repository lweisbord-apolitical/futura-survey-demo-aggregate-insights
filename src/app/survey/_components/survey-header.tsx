"use client";

import Image from "next/image";

export function SurveyHeader() {
  return (
    <header className="border-b border-neutral-100">
      <div className="px-6 sm:px-8 py-2.5">
        {/* Logo */}
        <Image
          src="/apolitical-logo.png"
          alt="Apolitical"
          width={200}
          height={47}
          priority
        />
      </div>
    </header>
  );
}
