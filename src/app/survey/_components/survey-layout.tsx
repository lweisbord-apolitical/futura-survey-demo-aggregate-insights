import { SurveyHeader } from "./survey-header";

interface SurveyLayoutProps {
  children: React.ReactNode;
}

export function SurveyLayout({ children }: SurveyLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white">
        <SurveyHeader />
      </div>
      <main className="px-6 sm:px-8 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  );
}
