"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type TabId = "now" | "matrix" | "trajectory" | "action";

const TABS: { id: TabId; label: string }[] = [
  { id: "now", label: "Where we are" },
  { id: "matrix", label: "Opportunity map" },
  { id: "trajectory", label: "5-year outlook" },
  { id: "action", label: "Recommendations" },
];

// Treemap data
const TREEMAP_DATA = [
  { task: "Email responses", hours: "186k", adoption: 12, size: "col-span-5 row-span-2", color: "bg-neutral-300 hover:bg-neutral-400", textColor: "text-neutral-700" },
  { task: "Meetings & calls", hours: "152k", adoption: 6, size: "col-span-4 row-span-2", color: "bg-neutral-200 hover:bg-neutral-300", textColor: "text-neutral-600" },
  { task: "Code", hours: "95k", adoption: 72, size: "col-span-3 row-span-2", color: "bg-violet-400 hover:bg-violet-500", textColor: "text-white" },
  { task: "Briefings", hours: "78k", adoption: 18, size: "col-span-3 row-span-2", color: "bg-neutral-300 hover:bg-neutral-400", textColor: "text-neutral-700" },
  { task: "Calendar", hours: "68k", adoption: 8, size: "col-span-3 row-span-2", color: "bg-neutral-200 hover:bg-neutral-300", textColor: "text-neutral-600" },
  { task: "Docs", hours: "53k", adoption: 78, size: "col-span-2 row-span-2", color: "bg-violet-500 hover:bg-violet-600", textColor: "text-white" },
  { task: "Social", hours: "43k", adoption: 75, size: "col-span-2 row-span-2", color: "bg-violet-400 hover:bg-violet-500", textColor: "text-white" },
  { task: "Analysis", hours: "38k", adoption: 28, size: "col-span-2 row-span-2", color: "bg-neutral-300 hover:bg-neutral-400", textColor: "text-neutral-700" },
];

const HIGH_ADOPTION_TASKS = [
  { task: "Write technical documentation", category: "Software Engineering • Content", adoption: 78 },
  { task: "Create social media content", category: "Communications • Content", adoption: 75 },
  { task: "Develop software code", category: "Software Engineering • Content", adoption: 72 },
  { task: "Draft press releases", category: "Communications • Content", adoption: 68 },
];

const HIGH_GAP_TASKS = [
  { task: "Prepare meeting notes", category: "Administrative • Content", gap: 79, exposure: 85, adoption: 6 },
  { task: "Respond to customer emails", category: "Administrative • Content", gap: 76, exposure: 88, adoption: 12 },
  { task: "Schedule meetings & calendars", category: "Administrative • Content", gap: 64, exposure: 72, adoption: 8 },
  { task: "Prepare briefing documents", category: "Policy & Strategy • Content", gap: 64, exposure: 82, adoption: 18 },
];

const GWA_GAPS = [
  { category: "Creating & producing", tasks: 24, gap: 36, using: 42, exposed: 78 },
  { category: "Analyzing & deciding", tasks: 12, gap: 30, using: 28, exposed: 58 },
  { category: "Research & gathering", tasks: 8, gap: 30, using: 22, exposed: 52 },
  { category: "Collaborating & communicating", tasks: 10, gap: 18, using: 6, exposed: 24 },
];

const ROLE_GAPS = [
  { role: "Administrative Assistant", dept: "Operations", employees: 12, gap: 74, using: 8, exposed: 82 },
  { role: "Financial Analyst", dept: "Finance", employees: 12, gap: 43, using: 25, exposed: 68 },
  { role: "Senior Advisor", dept: "Policy & Strategy", employees: 8, gap: 40, using: 15, exposed: 55 },
  { role: "HR Specialist", dept: "Human Resources", employees: 10, gap: 36, using: 22, exposed: 58 },
  { role: "Policy Analyst", dept: "Policy & Strategy", employees: 18, gap: 34, using: 28, exposed: 62 },
  { role: "Software Engineer", dept: "Technology", employees: 14, gap: 26, using: 52, exposed: 78 },
];

export default function LeaderDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("now");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-100">
        <div className="px-6 sm:px-8 max-w-5xl mx-auto py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/apolitical-logo.png"
              alt="Apolitical"
              width={140}
              height={33}
              priority
            />
            <span className="text-neutral-300">·</span>
            <span className="text-sm font-medium text-neutral-900">Workforce AI Readiness</span>
          </div>
          <div className="text-sm text-neutral-400">1,847 responses • Demo data</div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-neutral-100 bg-white sticky top-[57px] z-40">
        <div className="px-6 sm:px-8 max-w-5xl mx-auto flex gap-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-violet-600 text-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-6 sm:px-8 max-w-5xl mx-auto py-8 sm:py-12">
        {/* TAB 1: WHERE WE ARE NOW */}
        {activeTab === "now" && (
          <div>
            {/* Headline */}
            <div className="mb-10">
              <p className="text-sm text-neutral-400 mb-2">The headline</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                Your workforce is using AI for 24% of the work it could.
              </h1>
            </div>

            {/* Exposure Gap */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-4">Exposure gap</h2>

              {/* The bar */}
              <div className="relative h-8 bg-neutral-100 rounded-full overflow-hidden mb-8">
                <div className="absolute inset-y-0 left-0 bg-violet-200" style={{ width: "57%" }} />
                <div className="absolute inset-y-0 left-0 bg-violet-400" style={{ width: "38%" }} />
                <div className="absolute inset-y-0 left-0 bg-violet-600" style={{ width: "24%" }} />
              </div>

              {/* Three metrics */}
              <div className="grid grid-cols-3 gap-8">
                <div className="border-b-2 border-violet-600 pb-4">
                  <p className="text-sm text-neutral-500 mb-1">Current usage</p>
                  <p className="text-3xl font-semibold text-neutral-900">24%</p>
                  <p className="text-xs text-neutral-400 mt-1">Survey responses</p>
                </div>
                <div className="border-b-2 border-violet-400 pb-4">
                  <p className="text-sm text-neutral-500 mb-1">2026 exposure</p>
                  <p className="text-3xl font-semibold text-neutral-900">38%</p>
                  <p className="text-xs text-neutral-400 mt-1">Anthropic Economic Index</p>
                </div>
                <div className="border-b-2 border-violet-200 pb-4">
                  <p className="text-sm text-neutral-500 mb-1">2033 exposure</p>
                  <p className="text-3xl font-semibold text-neutral-900">57%</p>
                  <p className="text-xs text-neutral-400 mt-1">Elondou et al. · 7yr horizon</p>
                </div>
              </div>

              {/* Gap summary */}
              <div className="mt-8 pt-8 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">Total gap</p>
                    <p className="text-lg text-neutral-900">
                      <span className="font-semibold">33 points</span> between usage and 2033 exposure
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-neutral-400">~358k hrs/yr addressable</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Treemap */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Where the hours go</h2>
              <p className="text-sm text-neutral-500 mb-4">Size = total hours across org. Color = AI adoption rate.</p>

              <div className="border border-neutral-100 p-4">
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(4, 48px)" }}>
                  {TREEMAP_DATA.map((item) => (
                    <div
                      key={item.task}
                      className={`${item.size} ${item.color} rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
                    >
                      <div className="text-center px-2">
                        <p className={`text-sm font-medium ${item.textColor}`}>{item.task}</p>
                        <p className={`text-xs ${item.adoption > 50 ? "text-violet-100" : "text-neutral-500"}`}>
                          {item.hours} hrs • {item.adoption}% AI
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-neutral-200 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-neutral-200 rounded" />
                    <span className="text-neutral-500">0-20% AI</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-neutral-300 rounded" />
                    <span className="text-neutral-500">20-40% AI</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-violet-300 rounded" />
                    <span className="text-neutral-500">40-60% AI</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-violet-500 rounded" />
                    <span className="text-neutral-500">60%+ AI</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 pl-4 border-l-2 border-neutral-200">
                <p className="text-sm text-neutral-500">
                  <strong className="text-neutral-700">Insight:</strong> Email + Meetings + Calendar = 406,800 hours/year at &lt;12% AI adoption. That&apos;s 358,000 hours of manual work that could be augmented.
                </p>
              </div>
            </div>

            {/* Two Column: Working vs Not Working */}
            <div className="grid sm:grid-cols-2 gap-6 mb-10">
              {/* Where AI IS being used */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-neutral-900">Where AI is working</h2>
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-full">High adoption</span>
                </div>
                <p className="text-sm text-neutral-500 mb-4">Tasks where employees report using AI &quot;Often&quot; or &quot;Always&quot;</p>

                <div className="space-y-3">
                  {HIGH_ADOPTION_TASKS.map((item) => (
                    <div key={item.task} className="py-4 border-b-2 border-neutral-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.task}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-violet-600">{item.adoption}%</p>
                          <p className="text-xs text-neutral-400">adoption</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pl-4 border-l-2 border-neutral-200">
                  <p className="text-sm text-neutral-500">
                    <strong className="text-neutral-700">Pattern:</strong> Tech & Comms teams adopted first — 3x ahead of org average.
                  </p>
                </div>
              </div>

              {/* Where AI is NOT being used */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-neutral-900">Where AI should be used</h2>
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-full">High gap</span>
                </div>
                <p className="text-sm text-neutral-500 mb-4">Tasks with high Elondou exposure but low reported AI usage</p>

                <div className="space-y-3">
                  {HIGH_GAP_TASKS.map((item) => (
                    <div key={item.task} className="py-4 border-b-2 border-neutral-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.task}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-neutral-900">{item.gap}pt</p>
                          <p className="text-xs text-neutral-400">{item.exposure}% exp → {item.adoption}% adopt</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pl-4 border-l-2 border-neutral-200">
                  <p className="text-sm text-neutral-500">
                    <strong className="text-neutral-700">Pattern:</strong> Admin & Policy teams need enablement — same tasks, 10x less AI usage.
                  </p>
                </div>
              </div>
            </div>

            {/* By Work Activity Category */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Gap by work activity type</h2>
              <p className="text-sm text-neutral-500 mb-6">Grouped by the type of work being performed</p>

              <div className="space-y-4">
                {GWA_GAPS.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-neutral-700 font-medium">{item.category}</span>
                      <span className="text-neutral-500">
                        {item.tasks} tasks • <span className="text-neutral-700 font-medium">{item.gap}pt gap</span>
                      </span>
                    </div>
                    <div className="h-3 flex rounded-full overflow-hidden bg-neutral-100">
                      <div className="bg-violet-500" style={{ width: `${item.using}%` }} />
                      <div className="bg-neutral-300" style={{ width: `${item.gap}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>{item.using}% using AI</span>
                      <span>{item.exposed}% exposed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Tools in Use */}
            <div>
              <h2 className="text-lg font-medium text-neutral-900 mb-1">AI tools being used</h2>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-3 py-1.5 rounded-full text-sm bg-neutral-900 text-white">
                  ChatGPT <span className="text-neutral-400 ml-1">67%</span>
                </span>
                <span className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 text-neutral-600">
                  Microsoft Copilot <span className="text-neutral-400 ml-1">42%</span>
                </span>
                <span className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 text-neutral-600">
                  Claude <span className="text-neutral-400 ml-1">28%</span>
                </span>
                <span className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 text-neutral-600">
                  Perplexity <span className="text-neutral-400 ml-1">15%</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OPPORTUNITY MAP */}
        {activeTab === "matrix" && (
          <div>
            <div className="mb-10">
              <p className="text-sm text-neutral-400 mb-2">Opportunity map</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                Where to focus next.
              </h1>
            </div>

            {/* Pioneer callouts */}
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              <div className="py-4 px-5 border-b-2 border-violet-400">
                <p className="text-2xl font-semibold text-violet-600">127</p>
                <p className="text-sm text-neutral-600">Pioneers identified</p>
                <p className="text-xs text-neutral-400 mt-1">2x+ ahead of role average</p>
              </div>
              <div className="py-4 px-5 border-b-2 border-neutral-200">
                <p className="text-xl font-semibold text-neutral-900">Engineering, Admin, Policy</p>
                <p className="text-sm text-neutral-600">Roles with most pioneers</p>
                <p className="text-xs text-neutral-400 mt-1">68 pioneers across high-gap roles</p>
              </div>
              <div className="py-4 px-5 border-b-2 border-violet-200">
                <p className="text-xl font-semibold text-violet-600">Email, Notes, Briefings</p>
                <p className="text-sm text-neutral-600">Tasks pioneers cracked</p>
                <p className="text-xs text-neutral-400 mt-1">Interview them for playbooks</p>
              </div>
            </div>

            {/* Role Analysis */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Gap by role</h2>
              <p className="text-sm text-neutral-500 mb-6">Ranked by gap size — where enablement will have the biggest impact</p>

              <div className="space-y-4">
                {ROLE_GAPS.map((item) => (
                  <div key={item.role} className="py-4 border-b-2 border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{item.role}</p>
                        <p className="text-xs text-neutral-400">{item.dept} • {item.employees} employees</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${item.gap > 40 ? "text-neutral-900" : "text-violet-600"}`}>
                          {item.gap}pt
                        </p>
                        <p className="text-xs text-neutral-400">gap</p>
                      </div>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${item.using}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>{item.using}% using AI</span>
                      <span>{item.exposed}% exposed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 5-YEAR TRAJECTORY */}
        {activeTab === "trajectory" && (
          <div>
            <div className="mb-10">
              <p className="text-sm text-neutral-400 mb-2">5-year outlook</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                Today&apos;s 57% exposure becomes 85% by 2033.
              </h1>
            </div>

            {/* Timeline Visual */}
            <div className="border border-neutral-100 p-6 sm:p-8 mb-10">
              <div className="flex justify-between text-sm text-neutral-400 mb-6">
                <span className="font-medium text-neutral-700">2026</span>
                <span>2028</span>
                <span>2030</span>
                <span>2033</span>
                <span className="font-medium text-neutral-700">2036</span>
              </div>

              {/* Writing tasks */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Writing & Content</span>
                    <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">E1 - Direct LLM</span>
                  </div>
                  <span className="text-neutral-500">42% of work hours</span>
                </div>
                <div className="relative h-4 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-violet-500 rounded-full" style={{ width: "78%" }} />
                  <div className="absolute inset-y-0 bg-violet-400 rounded-full" style={{ left: "78%", width: "7%" }} />
                  <div className="absolute inset-y-0 bg-violet-300 rounded-full" style={{ left: "85%", width: "5%" }} />
                </div>
                <div className="flex justify-between text-xs text-neutral-400 mt-2">
                  <span className="text-violet-600 font-medium">78% exposed today</span>
                  <span>→ 85% by 2028</span>
                  <span>→ 90%+ by 2033</span>
                </div>
              </div>

              {/* Analysis tasks */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Analysis & Processing</span>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">E2 - LLM + Tools</span>
                  </div>
                  <span className="text-neutral-500">28% of work hours</span>
                </div>
                <div className="relative h-4 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-neutral-500 rounded-full" style={{ width: "58%" }} />
                  <div className="absolute inset-y-0 bg-neutral-400 rounded-full" style={{ left: "58%", width: "17%" }} />
                  <div className="absolute inset-y-0 bg-neutral-300 rounded-full" style={{ left: "75%", width: "13%" }} />
                </div>
                <div className="flex justify-between text-xs text-neutral-400 mt-2">
                  <span className="text-neutral-600 font-medium">58% exposed today</span>
                  <span>→ 75% by 2028</span>
                  <span>→ 88% by 2033</span>
                </div>
              </div>

              {/* Physical/interpersonal */}
              <div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Physical & Interpersonal</span>
                    <span className="text-xs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">E0 - Limited</span>
                  </div>
                  <span className="text-neutral-500">22% of work hours</span>
                </div>
                <div className="relative h-4 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-neutral-400 rounded-full" style={{ width: "24%" }} />
                  <div className="absolute inset-y-0 bg-violet-300 rounded-full" style={{ left: "24%", width: "8%" }} />
                  <div className="absolute inset-y-0 bg-violet-400 rounded-full" style={{ left: "32%", width: "33%" }} />
                </div>
                <div className="flex justify-between text-xs text-neutral-400 mt-2">
                  <span className="text-neutral-600 font-medium">24% exposed today</span>
                  <span>→ 32% by 2028</span>
                  <span className="text-violet-600 font-medium">→ 65% by 2033 (agents)</span>
                </div>
              </div>
            </div>

            {/* Projection Summary */}
            <div className="grid grid-cols-4 gap-4 mb-10">
              <div className="text-center py-4 border-b-2 border-neutral-900">
                <p className="text-2xl font-semibold text-neutral-900">57%</p>
                <p className="text-xs text-neutral-400">Today</p>
              </div>
              <div className="text-center py-4 border-b-2 border-neutral-200">
                <p className="text-2xl font-semibold text-neutral-700">68%</p>
                <p className="text-xs text-neutral-400">2028</p>
              </div>
              <div className="text-center py-4 border-b-2 border-neutral-200">
                <p className="text-2xl font-semibold text-neutral-700">78%</p>
                <p className="text-xs text-neutral-400">2030</p>
              </div>
              <div className="text-center py-4 border-b-2 border-violet-500">
                <p className="text-2xl font-semibold text-violet-600">85%</p>
                <p className="text-xs text-neutral-400">2033</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECOMMENDATIONS */}
        {activeTab === "action" && (
          <div>
            <div className="mb-10">
              <p className="text-sm text-neutral-400 mb-2">Recommendations</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                Three moves to close the gap.
              </h1>
            </div>

            <div className="space-y-8">
              {/* Recommendation 1 */}
              <div className="border border-neutral-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-900">Enable Admin & Policy teams first</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      74pt and 40pt gaps respectively. Same tasks as high-adoption teams, 10x less AI usage.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Email drafting workshops</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Meeting notes automation</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Briefing templates</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation 2 */}
              <div className="border border-neutral-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-900">Deploy pioneers as internal champions</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      127 employees are 2x+ ahead of their role average. Interview them for playbooks.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Peer training sessions</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Best practice docs</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Slack/Teams channels</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation 3 */}
              <div className="border border-neutral-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-900">Prepare for 2028+ exposure wave</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      Physical & interpersonal tasks go from 24% → 65% exposed. Start reskilling now.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Admin → Project Coordinator</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Writer → Content Strategist</span>
                      <span className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">Analyst → AI Tool Specialist</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-neutral-100">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to survey
          </Link>
        </div>
      </main>
    </div>
  );
}
