"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SurveyLayout } from "../_components/survey-layout";
import { ChatContainer } from "../_components/chat/chat-container";

export default function ChatPage() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState<string | null>(null);

  useEffect(() => {
    const storedJobTitle = sessionStorage.getItem("surveyJobTitle");
    if (!storedJobTitle) {
      router.replace("/survey");
      return;
    }
    setJobTitle(storedJobTitle);
  }, [router]);

  if (!jobTitle) {
    return (
      <SurveyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-500">Loading...</div>
        </div>
      </SurveyLayout>
    );
  }

  return (
    <SurveyLayout>
      <ChatContainer jobTitle={jobTitle} />
    </SurveyLayout>
  );
}
