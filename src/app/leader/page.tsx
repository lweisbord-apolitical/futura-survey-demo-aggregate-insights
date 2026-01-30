"use client";

import { useState, useEffect, useRef } from "react";
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
  { role: "Data Analyst", dept: "Technology", employees: 8, gap: 31, using: 41, exposed: 72 },
  { role: "Software Engineer", dept: "Technology", employees: 14, gap: 26, using: 52, exposed: 78 },
  { role: "Content Writer", dept: "Communications", employees: 5, gap: 23, using: 62, exposed: 85 },
];

const RESKILLING_ROLES = [
  {
    role: "Administrative Assistant",
    exposure2030: "94%",
    currentExposure: "82%",
    employees: 12,
    dept: "Operations",
    tasks: ["Email responses (88%)", "Meeting notes (85%)", "Calendar mgmt (72%)"],
    pathways: ["→ Project Coordinator", "→ Operations Analyst", "→ AI Tool Specialist"],
    adjacentSkills: "stakeholder communication, process optimization, tool configuration"
  },
  {
    role: "Content Writer",
    exposure2030: "95%",
    currentExposure: "85%",
    employees: 5,
    dept: "Communications",
    tasks: ["Social content (92%)", "Press releases (88%)", "Proofreading (85%)"],
    pathways: ["→ Content Strategist", "→ Brand Manager", "→ AI Prompt Engineer"],
    adjacentSkills: "editorial judgment, brand voice, AI output curation"
  },
  {
    role: "Data Analyst",
    exposure2030: "88%",
    currentExposure: "72%",
    employees: 8,
    dept: "Technology",
    tasks: ["SQL queries (82%)", "Visualizations (78%)", "Reports (75%)"],
    pathways: ["→ Data Scientist", "→ ML Engineer", "→ Analytics Manager"],
    adjacentSkills: "statistical modeling, machine learning, stakeholder insight translation"
  },
];

// Chart component for Opportunity Matrix
function OpportunityMatrixChart({ exposureYear }: { exposureYear: "2026" | "2030" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    const loadChart = async () => {
      const ChartJS = (await import("chart.js/auto")).default;

      if (!canvasRef.current) return;

      // Destroy existing chart
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }

      // 2026: Current state - based on today's AI capabilities
      const tasks2026 = {
        untapped: [
          {x: 85, y: 12, r: 12, name: 'Customer emails'},
          {x: 82, y: 6, r: 10, name: 'Meeting notes'},
          {x: 68, y: 8, r: 11, name: 'Calendar management'},
          {x: 78, y: 18, r: 9, name: 'Briefing docs'},
          {x: 72, y: 15, r: 10, name: 'Policy research'},
          {x: 75, y: 32, r: 10, name: 'Resume screening'},
          {x: 62, y: 4, r: 10, name: 'Document filing'},
          {x: 70, y: 25, r: 11, name: 'Budget reports'},
        ],
        realized: [
          {x: 88, y: 78, r: 8, name: 'Technical docs'},
          {x: 90, y: 75, r: 10, name: 'Social content'},
          {x: 85, y: 72, r: 14, name: 'Software code'},
          {x: 82, y: 68, r: 9, name: 'Press releases'},
          {x: 78, y: 58, r: 8, name: 'Code review'},
          {x: 75, y: 55, r: 9, name: 'SQL queries'},
        ],
        unexpected: [
          {x: 32, y: 35, r: 6, name: 'Team coordination'},
          {x: 38, y: 28, r: 5, name: 'Stakeholder comms'},
        ],
        manual: [
          {x: 22, y: 6, r: 11, name: 'Stakeholder meetings'},
          {x: 8, y: 2, r: 8, name: 'Greeting visitors'},
          {x: 15, y: 4, r: 11, name: 'Employee interviews'},
          {x: 12, y: 3, r: 8, name: 'Field inspections'},
          {x: 18, y: 5, r: 7, name: 'Site visits'},
          {x: 10, y: 8, r: 8, name: 'Mentoring'},
          {x: 28, y: 6, r: 9, name: 'Workshops'},
          {x: 25, y: 12, r: 8, name: 'Strategic planning'},
        ]
      };

      // 2030: Projected state - agents, multimodal AI, better integration
      const tasks2030 = {
        untapped: [
          {x: 96, y: 12, r: 12, name: 'Customer emails'},
          {x: 94, y: 6, r: 10, name: 'Meeting notes'},
          {x: 92, y: 8, r: 11, name: 'Calendar management'},
          {x: 95, y: 18, r: 9, name: 'Briefing docs'},
          {x: 90, y: 15, r: 10, name: 'Policy research'},
          {x: 94, y: 32, r: 10, name: 'Resume screening'},
          {x: 88, y: 4, r: 10, name: 'Document filing'},
          {x: 92, y: 25, r: 11, name: 'Budget reports'},
          // Tasks that become exposed by 2030 (were manual in 2026)
          {x: 72, y: 6, r: 11, name: 'Stakeholder meetings'},
          {x: 65, y: 4, r: 11, name: 'Employee interviews'},
          {x: 58, y: 3, r: 8, name: 'Field inspections'},
          {x: 78, y: 6, r: 9, name: 'Workshops'},
          {x: 68, y: 12, r: 8, name: 'Strategic planning'},
        ],
        realized: [
          {x: 98, y: 82, r: 8, name: 'Technical docs'},
          {x: 98, y: 78, r: 10, name: 'Social content'},
          {x: 95, y: 75, r: 14, name: 'Software code'},
          {x: 96, y: 72, r: 9, name: 'Press releases'},
          {x: 94, y: 65, r: 8, name: 'Code review'},
          {x: 92, y: 62, r: 9, name: 'SQL queries'},
          // Tasks that move to "realized" by 2030
          {x: 88, y: 58, r: 10, name: 'Policy research'},
          {x: 85, y: 52, r: 9, name: 'Budget analysis'},
        ],
        unexpected: [
          {x: 65, y: 42, r: 6, name: 'Team coordination'},
          {x: 72, y: 38, r: 5, name: 'Stakeholder comms'},
          {x: 58, y: 35, r: 7, name: 'Project management'},
        ],
        manual: [
          // Only truly physical/human tasks remain low exposure
          {x: 25, y: 2, r: 8, name: 'Greeting visitors'},
          {x: 35, y: 5, r: 7, name: 'Site visits'},
          {x: 42, y: 8, r: 8, name: 'Mentoring'},
        ]
      };

      const tasks = exposureYear === "2030" ? tasks2030 : tasks2026;

      chartRef.current = new ChartJS(canvasRef.current, {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Opportunity',
              data: tasks.untapped,
              backgroundColor: 'rgba(249, 115, 22, 0.7)',
              borderColor: 'rgba(234, 88, 12, 0.9)',
              borderWidth: 1
            },
            {
              label: 'Adopting',
              data: tasks.realized,
              backgroundColor: 'rgba(139, 92, 246, 0.65)',
              borderColor: 'rgba(124, 58, 237, 0.85)',
              borderWidth: 1
            },
            {
              label: 'Adopting (low)',
              data: tasks.unexpected,
              backgroundColor: 'rgba(167, 139, 250, 0.6)',
              borderColor: 'rgba(139, 92, 246, 0.8)',
              borderWidth: 1
            },
            {
              label: 'Low exposure',
              data: tasks.manual,
              backgroundColor: 'rgba(212, 212, 212, 0.5)',
              borderColor: 'rgba(163, 163, 163, 0.6)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
          scales: {
            x: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: 'AI Exposure →',
                color: '#737373',
                font: { size: 12, weight: 500 }
              },
              grid: { color: '#e5e5e5' },
              ticks: {
                callback: (v) => v + '%',
                color: '#a3a3a3',
                font: { size: 11 }
              }
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: '↑ Current Adoption',
                color: '#737373',
                font: { size: 12, weight: 500 }
              },
              grid: { color: '#e5e5e5' },
              ticks: {
                callback: (v) => v + '%',
                color: '#a3a3a3',
                font: { size: 11 }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#171717',
              titleColor: '#fff',
              bodyColor: '#e5e5e5',
              padding: 12,
              cornerRadius: 6,
              callbacks: {
                title: (items) => {
                  const item = items[0];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return (item.raw as any).name || '';
                },
                label: (item) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const raw = item.raw as any;
                  return [`Exposure: ${raw.x}%`, `Adoption: ${raw.y}%`];
                }
              }
            }
          }
        }
      });
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [exposureYear]);

  return <canvas ref={canvasRef} />;
}

// Chart component for Pioneer Map
function PioneerMapChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    const loadChart = async () => {
      const ChartJS = (await import("chart.js/auto")).default;

      if (!canvasRef.current) return;

      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }

      // Generate realistic pioneer data based on role clusters
      const pioneers: { x: number; y: number; r: number }[] = [];
      const others: { x: number; y: number; r: number }[] = [];

      // Define role clusters with their characteristics
      // { avgAdoption, spread, count, pioneerRatio }
      const roleClusters = [
        { name: 'Software Engineers', avgAdoption: 52, spread: 12, count: 140, pioneerRatio: 0.18 },
        { name: 'Content Writers', avgAdoption: 62, spread: 10, count: 50, pioneerRatio: 0.16 },
        { name: 'Data Analysts', avgAdoption: 41, spread: 14, count: 80, pioneerRatio: 0.12 },
        { name: 'Policy Analysts', avgAdoption: 28, spread: 15, count: 180, pioneerRatio: 0.08 },
        { name: 'Financial Analysts', avgAdoption: 25, spread: 12, count: 120, pioneerRatio: 0.06 },
        { name: 'HR Specialists', avgAdoption: 22, spread: 10, count: 100, pioneerRatio: 0.05 },
        { name: 'Senior Advisors', avgAdoption: 15, spread: 8, count: 80, pioneerRatio: 0.04 },
        { name: 'Admin Assistants', avgAdoption: 8, spread: 6, count: 120, pioneerRatio: 0.15 }, // High pioneer ratio despite low avg
        { name: 'Other Roles', avgAdoption: 24, spread: 18, count: 200, pioneerRatio: 0.07 },
      ];

      // Gaussian-ish random for more realistic distribution
      const gaussRandom = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };

      roleClusters.forEach(cluster => {
        const numPioneers = Math.round(cluster.count * cluster.pioneerRatio);
        const numOthers = cluster.count - numPioneers;

        // Generate pioneers (significantly above their role average)
        for (let i = 0; i < numPioneers; i++) {
          const roleAvg = cluster.avgAdoption + gaussRandom() * (cluster.spread * 0.3);
          const clampedRoleAvg = Math.max(5, Math.min(85, roleAvg));
          // Pioneers are 1.5x to 3x their role average
          const multiplier = 1.5 + Math.random() * 1.5;
          const individual = Math.min(98, clampedRoleAvg * multiplier + gaussRandom() * 8);
          pioneers.push({
            x: clampedRoleAvg,
            y: Math.max(clampedRoleAvg + 10, individual),
            r: 2.5 + Math.random() * 2.5
          });
        }

        // Generate others (at or below role average, with natural variation)
        for (let i = 0; i < numOthers; i++) {
          const roleAvg = cluster.avgAdoption + gaussRandom() * cluster.spread;
          const clampedRoleAvg = Math.max(3, Math.min(80, roleAvg));
          // Most people cluster around their role average, some below
          const variance = gaussRandom() * 12;
          const individual = clampedRoleAvg + variance - 5; // Slight downward bias
          others.push({
            x: clampedRoleAvg,
            y: Math.max(0, Math.min(clampedRoleAvg + 8, individual)),
            r: 2 + Math.random() * 2
          });
        }
      });

      // Add some outliers for realism
      // Low adopters in high-adoption roles
      for (let i = 0; i < 30; i++) {
        const roleAvg = 45 + Math.random() * 25;
        others.push({ x: roleAvg, y: Math.random() * 15, r: 2 + Math.random() * 1.5 });
      }
      // High adopters who are exactly at average (not pioneers, just consistent)
      for (let i = 0; i < 40; i++) {
        const roleAvg = 30 + Math.random() * 40;
        others.push({ x: roleAvg, y: roleAvg + (Math.random() - 0.5) * 6, r: 2 + Math.random() * 2 });
      }

      chartRef.current = new ChartJS(canvasRef.current, {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Pioneers',
              data: pioneers,
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: 'rgba(124, 58, 237, 0.8)',
              borderWidth: 1
            },
            {
              label: 'Others',
              data: others,
              backgroundColor: 'rgba(163, 163, 163, 0.4)',
              borderColor: 'rgba(163, 163, 163, 0.6)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: 'Role Average AI Adoption →',
                color: '#737373',
                font: { size: 12, weight: 500 }
              },
              grid: { color: '#e5e5e5' },
              ticks: {
                callback: (v) => v + '%',
                color: '#a3a3a3',
                font: { size: 11 }
              }
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: '↑ Individual AI Adoption',
                color: '#737373',
                font: { size: 12, weight: 500 }
              },
              grid: { color: '#e5e5e5' },
              ticks: {
                callback: (v) => v + '%',
                color: '#a3a3a3',
                font: { size: 11 }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#171717',
              titleColor: '#fff',
              bodyColor: '#e5e5e5',
              padding: 12,
              cornerRadius: 6
            }
          }
        }
      });

      // Draw diagonal line after chart renders
      const chart = chartRef.current as { ctx: CanvasRenderingContext2D; chartArea: { left: number; right: number; top: number; bottom: number } };
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;

      ctx.save();
      ctx.strokeStyle = '#a3a3a3';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, chartArea.bottom);
      ctx.lineTo(chartArea.right, chartArea.top);
      ctx.stroke();
      ctx.restore();
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return <canvas ref={canvasRef} />;
}

export default function LeaderDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("now");
  const [exposureYear, setExposureYear] = useState<"2026" | "2030">("2026");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-100">
        <div className="px-6 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/apolitical-logo.png"
              alt="Apolitical"
              width={160}
              height={38}
              priority
            />
            <div className="h-6 w-px bg-neutral-200" />
            <span className="text-sm font-medium text-neutral-600">Acme Corporation</span>
          </div>
          <div className="text-sm text-neutral-400">1,847 responses • Demo data</div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-neutral-100 bg-white sticky top-[62px] z-40">
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
            {/* AI Readiness Gap - Single Hero Card */}
            <div className="p-8 bg-neutral-50 rounded-xl mb-8">
              <h2 className="text-xs font-medium text-violet-600 tracking-wide uppercase mb-6">AI Readiness Gap</h2>

              {/* Headline with arrow */}
              <div className="mb-2">
                <span className="text-6xl font-bold text-violet-600">24%</span>
                <span className="text-3xl text-neutral-400 mx-4">→</span>
                <span className="text-6xl font-bold text-neutral-900">60%</span>
              </div>

              {/* Subtitle */}
              <p className="text-lg text-neutral-600 mb-2">
                of tasks use AI today <span className="text-neutral-400">→</span> will be AI-exposed by 2030
              </p>

              {/* Description */}
              <p className="text-sm text-neutral-400 mb-6">Based on task-by-task analysis across your workforce</p>

              {/* Visual blocks - 10 total */}
              <div className="flex gap-2 mb-4">
                {/* Tasks using AI today (3 blocks = ~24%) - solid purple */}
                <div className="w-14 h-16 bg-violet-500 rounded-lg" />
                <div className="w-14 h-16 bg-violet-500 rounded-lg" />
                <div className="w-14 h-16 bg-violet-500 rounded-lg" />
                {/* Tasks exposed by 2030 (3 blocks = gap to 60%) - light purple with dashed border */}
                <div className="w-14 h-16 bg-violet-100 rounded-lg border-2 border-dashed border-violet-300" />
                <div className="w-14 h-16 bg-violet-100 rounded-lg border-2 border-dashed border-violet-300" />
                <div className="w-14 h-16 bg-violet-100 rounded-lg border-2 border-dashed border-violet-300" />
                {/* Not exposed (4 blocks = remaining 40%) - gray */}
                <div className="w-14 h-16 bg-neutral-200 rounded-lg" />
                <div className="w-14 h-16 bg-neutral-200 rounded-lg" />
                <div className="w-14 h-16 bg-neutral-200 rounded-lg" />
                <div className="w-14 h-16 bg-neutral-200 rounded-lg" />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-violet-500 rounded" />
                  <span className="text-neutral-600">Tasks using AI today</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-violet-100 rounded border-2 border-dashed border-violet-300" />
                  <span className="text-neutral-500">Tasks exposed by 2030</span>
                </span>
              </div>
            </div>

            {/* Treemap */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Where the hours go</h2>
              <p className="text-sm text-neutral-500 mb-4">Size = total hours across org. Color = AI adoption rate.</p>

              <div className="border border-neutral-100 p-4">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: "repeat(12, 1fr)",
                    gridTemplateRows: "repeat(6, 48px)"
                  }}
                >
                  {/* Row 1-2 */}
                  <div
                    className="bg-neutral-300 hover:bg-neutral-400 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 5", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-neutral-700">Email responses</p>
                      <p className="text-xs text-neutral-500">186k hrs • 12% AI</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 4", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-neutral-600">Meetings & calls</p>
                      <p className="text-xs text-neutral-400">152k hrs • 6% AI</p>
                    </div>
                  </div>
                  <div
                    className="bg-violet-400 hover:bg-violet-500 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 3", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-white">Code</p>
                      <p className="text-xs text-violet-100">95k hrs • 72% AI</p>
                    </div>
                  </div>

                  {/* Row 3-4 */}
                  <div
                    className="bg-neutral-300 hover:bg-neutral-400 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 3", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-neutral-700">Briefings</p>
                      <p className="text-xs text-neutral-500">78k hrs • 18% AI</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 3", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-neutral-600">Calendar</p>
                      <p className="text-xs text-neutral-400">68k hrs • 8% AI</p>
                    </div>
                  </div>
                  <div
                    className="bg-violet-500 hover:bg-violet-600 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-white">Docs</p>
                      <p className="text-xs text-violet-100">53k • 78%</p>
                    </div>
                  </div>
                  <div
                    className="bg-violet-400 hover:bg-violet-500 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-white">Social</p>
                      <p className="text-xs text-violet-100">43k • 75%</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-300 hover:bg-neutral-400 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-2">
                      <p className="text-sm font-medium text-neutral-700">Analysis</p>
                      <p className="text-xs text-neutral-500">38k • 28%</p>
                    </div>
                  </div>

                  {/* Row 5-6 */}
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-neutral-600">Notes</p>
                      <p className="text-xs text-neutral-400">34k • 6%</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-300 hover:bg-neutral-400 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-neutral-700">Budget</p>
                      <p className="text-xs text-neutral-500">33k • 22%</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-neutral-600">Filing</p>
                      <p className="text-xs text-neutral-400">29k • 4%</p>
                    </div>
                  </div>
                  <div
                    className="bg-violet-300 hover:bg-violet-400 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-violet-800">Research</p>
                      <p className="text-xs text-violet-600">26k • 52%</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-neutral-600">Coord</p>
                      <p className="text-xs text-neutral-400">22k • 8%</p>
                    </div>
                  </div>
                  <div
                    className="bg-neutral-200 hover:bg-neutral-300 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                    style={{ gridColumn: "span 2", gridRow: "span 2" }}
                  >
                    <div className="text-center px-1">
                      <p className="text-xs font-medium text-neutral-600">Other</p>
                      <p className="text-xs text-neutral-400">18k • 15%</p>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-200">
                  <div className="flex items-center gap-4 text-xs">
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
                  <p className="text-xs text-neutral-400">Click any task for details</p>
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
                <p className="text-sm text-neutral-500 mb-4">Tasks with high AI potential but low reported AI usage</p>

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

            {/* Task Opportunity Chart */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-medium text-neutral-900">Task opportunities</h2>
                <div className="inline-flex rounded-full bg-neutral-100 p-0.5">
                  <button
                    onClick={() => setExposureYear("2026")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      exposureYear === "2026" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    2026
                  </button>
                  <button
                    onClick={() => setExposureYear("2030")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      exposureYear === "2030" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    2030
                  </button>
                </div>
              </div>
              <p className="text-sm text-neutral-500 mb-4">Tasks plotted by AI exposure (x) vs current adoption (y). Bubble size = hours.</p>

              <div className="border border-neutral-100 p-6">
                <div className="relative" style={{ height: "420px" }}>
                  <OpportunityMatrixChart exposureYear={exposureYear} />
                </div>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-100 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: "#f97316" }} />
                    <span className="text-neutral-600">Opportunity — high exposure, low adoption</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-violet-500" />
                    <span className="text-neutral-600">Already adopting</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-neutral-300" />
                    <span className="text-neutral-500">Low exposure</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Pioneer Map */}
            <div className="mb-10">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Find your pioneers</h2>
              <p className="text-sm text-neutral-500 mb-4">Each dot is a person. Dots above the line are ahead of their role&apos;s average — your internal champions.</p>

              <div className="border border-neutral-100 p-6">
                <div className="relative" style={{ height: "360px" }}>
                  <PioneerMapChart />
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-violet-500 rounded-full" />
                      <span className="text-neutral-500">Pioneers (above line)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-neutral-400 rounded-full" />
                      <span className="text-neutral-500">At or below average</span>
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">Sample view • 1,847 total responses</p>
                </div>
              </div>

              {/* Pioneer callouts */}
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div className="py-4 px-5 border-b-2 border-violet-400">
                  <p className="text-2xl font-semibold text-violet-600">127</p>
                  <p className="text-sm text-neutral-600">Pioneers identified</p>
                  <p className="text-xs text-neutral-400 mt-1">2x+ ahead of role average</p>
                </div>
                <div className="py-4 px-5 border-b-2 border-neutral-200">
                  <p className="text-2xl font-semibold text-neutral-900">Engineering, Admin, Policy</p>
                  <p className="text-sm text-neutral-600">Roles with most pioneers</p>
                  <p className="text-xs text-neutral-400 mt-1">68 pioneers across high-gap roles</p>
                </div>
                <div className="py-4 px-5 border-b-2 border-violet-200">
                  <p className="text-2xl font-semibold text-violet-600">Email, Notes, Briefings</p>
                  <p className="text-sm text-neutral-600">Tasks pioneers cracked</p>
                  <p className="text-xs text-neutral-400 mt-1">Interview them for playbooks</p>
                </div>
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
                        <p className={`text-lg font-semibold ${item.gap > 35 ? "text-neutral-900" : "text-violet-600"}`}>
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
              <p className="text-sm text-neutral-400 mb-2">Based on AI capability research & industry forecasts</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                How AI exposure will evolve through 2030.
              </h1>
              <p className="text-neutral-500 mt-3">These projections combine current AI benchmarks with research from Anthropic, OpenAI, and academic studies on task automation potential.</p>
            </div>

            {/* Key insight */}
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-violet-900">
                <strong>Key insight:</strong> Your workforce currently uses AI for 24% of exposed tasks. By 2030, the exposure ceiling rises from 57% to 85% — but the real opportunity is closing today&apos;s 33-point gap before the ceiling rises further.
              </p>
            </div>

            {/* Timeline Visual */}
            <div className="border border-neutral-100 p-6 sm:p-8 mb-10">
              <h3 className="text-sm font-medium text-neutral-700 mb-4">Projected AI exposure by work category</h3>

              {/* Writing tasks */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Writing & Content Creation</span>
                    <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">Highest exposure</span>
                  </div>
                  <span className="text-neutral-500">42% of your workforce hours</span>
                </div>
                <div className="relative h-5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-violet-600 rounded-l-full" style={{ width: "78%" }} />
                  <div className="absolute inset-y-0 left-0 bg-violet-400" style={{ width: "90%", opacity: 0.5 }} />
                  <div className="absolute inset-y-0 left-0 bg-violet-300" style={{ width: "95%", opacity: 0.3 }} />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-violet-600 font-medium">78% today</span>
                  <span className="text-neutral-400">90% by 2028</span>
                  <span className="text-neutral-500 font-medium">95% by 2030</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Emails, reports, documentation, social content — already highly automatable with current LLMs</p>
              </div>

              {/* Analysis tasks */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Analysis & Decision Support</span>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">Growing exposure</span>
                  </div>
                  <span className="text-neutral-500">28% of your workforce hours</span>
                </div>
                <div className="relative h-5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-neutral-600 rounded-l-full" style={{ width: "58%" }} />
                  <div className="absolute inset-y-0 left-0 bg-neutral-400" style={{ width: "78%", opacity: 0.5 }} />
                  <div className="absolute inset-y-0 left-0 bg-neutral-300" style={{ width: "88%", opacity: 0.3 }} />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-neutral-600 font-medium">58% today</span>
                  <span className="text-neutral-400">78% by 2028</span>
                  <span className="text-neutral-500 font-medium">88% by 2030</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Data analysis, research synthesis, budget review — requires AI + tool integration (coming 2025-2028)</p>
              </div>

              {/* Coordination tasks */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Coordination & Communication</span>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Emerging exposure</span>
                  </div>
                  <span className="text-neutral-500">18% of your workforce hours</span>
                </div>
                <div className="relative h-5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-l-full" style={{ width: "35%" }} />
                  <div className="absolute inset-y-0 left-0 bg-blue-400" style={{ width: "55%", opacity: 0.5 }} />
                  <div className="absolute inset-y-0 left-0 bg-blue-300" style={{ width: "72%", opacity: 0.3 }} />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-blue-600 font-medium">35% today</span>
                  <span className="text-neutral-400">55% by 2028</span>
                  <span className="text-neutral-500 font-medium">72% by 2030</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Meeting scheduling, stakeholder updates, project tracking — AI agents will transform this category</p>
              </div>

              {/* Physical/interpersonal */}
              <div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">Physical & In-Person Work</span>
                    <span className="text-xs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">Limited exposure</span>
                  </div>
                  <span className="text-neutral-500">12% of your workforce hours</span>
                </div>
                <div className="relative h-5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-neutral-400 rounded-l-full" style={{ width: "15%" }} />
                  <div className="absolute inset-y-0 left-0 bg-neutral-300" style={{ width: "25%", opacity: 0.5 }} />
                  <div className="absolute inset-y-0 left-0 bg-neutral-200" style={{ width: "40%", opacity: 0.3 }} />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-neutral-600 font-medium">15% today</span>
                  <span className="text-neutral-400">25% by 2028</span>
                  <span className="text-neutral-500 font-medium">40% by 2030</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Site visits, in-person meetings, mentoring — human presence remains essential, AI assists with prep/follow-up</p>
              </div>
            </div>

            {/* Projection Summary */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-neutral-700 mb-4">Overall workforce AI exposure trajectory</h3>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-10">
              <div className="text-center py-4 border-b-2 border-violet-600">
                <p className="text-2xl font-semibold text-neutral-900">57%</p>
                <p className="text-xs text-neutral-500">Today (2026)</p>
                <p className="text-xs text-violet-600 mt-1">24% adopted</p>
              </div>
              <div className="text-center py-4 border-b-2 border-neutral-300">
                <p className="text-2xl font-semibold text-neutral-700">71%</p>
                <p className="text-xs text-neutral-500">2028</p>
                <p className="text-xs text-neutral-400 mt-1">Agents arrive</p>
              </div>
              <div className="text-center py-4 border-b-2 border-neutral-300">
                <p className="text-2xl font-semibold text-neutral-700">80%</p>
                <p className="text-xs text-neutral-500">2030</p>
                <p className="text-xs text-neutral-400 mt-1">Tool integration</p>
              </div>
              <div className="text-center py-4 border-b-2 border-violet-500">
                <p className="text-2xl font-semibold text-violet-600">85%</p>
                <p className="text-xs text-neutral-500">2030</p>
                <p className="text-xs text-violet-600 mt-1">Technical ceiling</p>
              </div>
            </div>

            {/* Roles Most Affected */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-medium text-neutral-900 mb-4">Roles most affected by 2030</h2>
                <div className="space-y-3">
                  <div className="py-3 border-b-2 border-neutral-200 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Administrative Assistant</span>
                    <span className="text-sm"><span className="text-neutral-400">82% →</span> <span className="font-semibold text-neutral-900">94%</span></span>
                  </div>
                  <div className="py-3 border-b-2 border-neutral-200 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Content Writer</span>
                    <span className="text-sm"><span className="text-neutral-400">85% →</span> <span className="font-semibold text-neutral-900">95%</span></span>
                  </div>
                  <div className="py-3 border-b-2 border-neutral-200 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Data Analyst</span>
                    <span className="text-sm"><span className="text-neutral-400">72% →</span> <span className="font-semibold text-neutral-900">88%</span></span>
                  </div>
                  <div className="py-3 border-b-2 border-neutral-200 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Financial Analyst</span>
                    <span className="text-sm"><span className="text-neutral-400">68% →</span> <span className="font-semibold text-neutral-900">85%</span></span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium text-neutral-900 mb-4">Tasks becoming exposed (2026-2030)</h2>
                <div className="space-y-3">
                  <div className="py-3 border-b-2 border-neutral-200">
                    <p className="text-sm font-medium text-neutral-900">Conduct user interviews</p>
                    <p className="text-xs text-neutral-400">18% → 55% (AI transcription + synthesis)</p>
                  </div>
                  <div className="py-3 border-b-2 border-neutral-200">
                    <p className="text-sm font-medium text-neutral-900">Collect field samples</p>
                    <p className="text-xs text-neutral-400">15% → 42% (sensor automation)</p>
                  </div>
                  <div className="py-3 border-b-2 border-neutral-200">
                    <p className="text-sm font-medium text-neutral-900">Facilitate workshops</p>
                    <p className="text-xs text-neutral-400">32% → 58% (AI facilitation tools)</p>
                  </div>
                </div>
                <div className="mt-4 pl-4 border-l-2 border-neutral-200">
                  <p className="text-sm text-neutral-500">
                    <strong className="text-neutral-700">Driver:</strong> Multimodal AI + autonomous agents will expose interpersonal and collaborative tasks.
                  </p>
                </div>
              </div>
            </div>

            {/* Reskilling Priorities */}
            <div className="mt-10 pt-10 border-t border-neutral-100">
              <h2 className="text-lg font-medium text-neutral-900 mb-1">Reskilling priorities</h2>
              <p className="text-sm text-neutral-500 mb-6">Roles with 85%+ exposure by 2030 — consider proactive skill development</p>

              <div className="space-y-6">
                {RESKILLING_ROLES.map((role) => (
                  <div key={role.role} className="border border-neutral-100 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-medium text-neutral-900">{role.role}</p>
                          <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{role.exposure2030} by 2030</span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-1">{role.employees} employees • {role.dept}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">Current exposure</p>
                        <p className="text-lg font-semibold text-neutral-900">{role.currentExposure}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-neutral-500 mb-2">Most exposed tasks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {role.tasks.map((task) => (
                          <span key={task} className="px-2 py-1 bg-neutral-50 rounded text-xs text-neutral-600">{task}</span>
                        ))}
                      </div>
                    </div>

                    <div className="pl-4 border-l-2 border-neutral-200">
                      <p className="text-xs text-neutral-500 mb-1">Suggested reskilling pathways</p>
                      <div className="flex flex-wrap gap-2">
                        {role.pathways.map((pathway) => (
                          <span key={pathway} className="px-2.5 py-1 bg-neutral-50 rounded-full text-xs font-medium text-neutral-700">{pathway}</span>
                        ))}
                      </div>
                      <p className="text-xs text-neutral-400 mt-2">Adjacent skills: {role.adjacentSkills}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pl-4 border-l-2 border-neutral-200">
                <p className="text-sm text-neutral-500">
                  <strong className="text-neutral-700">Methodology:</strong> Reskilling pathways based on skill adjacency analysis and projected skill demand growth.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECOMMENDATIONS */}
        {activeTab === "action" && (
          <div>
            <div className="mb-10">
              <p className="text-sm text-neutral-400 mb-2">Based on your survey data & comparable public sector organisations</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                Three priorities to close the gap.
              </h1>
              <p className="text-neutral-500 mt-3">These recommendations are informed by patterns we&apos;ve seen across 50+ government departments and validated by research from Anthropic, OpenAI, and the Brookings Institution.</p>
            </div>

            {/* Priority 1 */}
            <div className="mb-10 border border-neutral-200">
              <div className="px-6 py-4 border-b border-neutral-100">
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-neutral-900 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">1</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-neutral-900">Launch an AI pilot for Administrative teams</h2>
                      <span className="text-xs bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full font-medium">Highest ROI</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">74-point gap between exposure and adoption — the largest in the organization</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Why this matters</h3>
                  <p className="text-sm text-neutral-600">Admin Assistants spend 186,400 hours/year on email alone — at 12% AI adoption. The same task in Tech teams runs at 68% adoption. This isn&apos;t a capability gap; it&apos;s an enablement gap. We identified <strong className="text-violet-600">23 pioneers</strong> in Admin roles already using AI effectively — they&apos;re proving it works.</p>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">186</p>
                    <p className="text-xs text-neutral-500">People affected</p>
                  </div>
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">4,200</p>
                    <p className="text-xs text-neutral-500">Hours/week recoverable</p>
                  </div>
                  <div className="border-b-2 border-violet-400 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">$9.8M</p>
                    <p className="text-xs text-neutral-500">Annual value</p>
                  </div>
                  <div className="border-b-2 border-violet-200 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">4 wks</p>
                    <p className="text-xs text-neutral-500">To first results</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-3">Action steps</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">1</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Interview the 23 Admin pioneers identified in the survey</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Document their workflows, prompts, and workarounds. Create a playbook.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 1</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">2</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Deploy meeting transcription + summary tools org-wide</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Microsoft Copilot or Otter.ai. No integration required — just turn it on.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 2</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">3</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Run 2-hour &quot;AI for Email&quot; workshops led by pioneers</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Peer-led training. Cover: drafting replies, summarizing threads, extracting action items.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 3-4</span>
                    </div>
                    <div className="flex items-start gap-3 py-3">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">4</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Measure adoption weekly via pulse survey</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Track ai_frequency for email, meetings, calendar tasks. Target: 40% adoption in 8 weeks.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Ongoing</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Success looks like</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-neutral-600">Admin AI adoption: <strong>12% → 45%</strong> in 90 days</span>
                    <span className="text-neutral-600">Avg email time: <strong>-35%</strong></span>
                    <span className="text-neutral-600">Meeting notes: <strong>auto-generated for 80%</strong> of meetings</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Priority 2 */}
            <div className="mb-10 border border-neutral-200">
              <div className="px-6 py-4 border-b border-neutral-100">
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-neutral-700 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">2</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-neutral-900">Cross-pollinate from Tech to Policy & Finance</h2>
                      <span className="text-xs bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full font-medium">Knowledge transfer</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">Same writing tasks, 3x adoption difference — this is a sharing problem, not a tool problem</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Why this matters</h3>
                  <p className="text-sm text-neutral-600">Policy Analysts and Software Engineers both write documents, synthesize research, and create briefings. But Tech is at 68% adoption while Policy is at 28%. The survey shows Policy teams <em>want</em> to use AI (72% expressed interest) but lack guidance on how to apply it to their specific work. We found <strong className="text-violet-600">31 pioneers</strong> in Policy/Finance who&apos;ve figured it out.</p>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">380</p>
                    <p className="text-xs text-neutral-500">People affected</p>
                  </div>
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">2,800</p>
                    <p className="text-xs text-neutral-500">Hours/week recoverable</p>
                  </div>
                  <div className="border-b-2 border-violet-400 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">$6.5M</p>
                    <p className="text-xs text-neutral-500">Annual value</p>
                  </div>
                  <div className="border-b-2 border-violet-200 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">8 wks</p>
                    <p className="text-xs text-neutral-500">To first results</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-3">Action steps</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">1</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Create a &quot;Prompt Library&quot; for policy-specific tasks</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Briefing summaries, legislative analysis, stakeholder mapping. Curate from pioneer interviews.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 1-2</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">2</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Pair 10 Policy Analysts with Tech mentors for 4 weeks</p>
                        <p className="text-xs text-neutral-500 mt-0.5">30-min weekly check-ins. Focus on their actual current projects, not hypotheticals.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 2-6</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">3</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Run &quot;Show & Tell&quot; sessions — 15 min demos of real work</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Weekly, open to all. &quot;Here&apos;s how I used AI on the climate brief last week.&quot;</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 3+</span>
                    </div>
                    <div className="flex items-start gap-3 py-3">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">4</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Embed AI usage into existing workflows</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Add &quot;AI-assisted?&quot; checkbox to briefing templates. Normalize the behavior.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 4</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Success looks like</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-neutral-600">Policy/Finance adoption: <strong>26% → 50%</strong> in 90 days</span>
                    <span className="text-neutral-600">Prompt library: <strong>50+ vetted prompts</strong></span>
                    <span className="text-neutral-600">Cross-team pairs: <strong>20 active mentorships</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Priority 3 */}
            <div className="mb-10 border border-neutral-200">
              <div className="px-6 py-4 border-b border-neutral-100">
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-neutral-500 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">3</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-neutral-900">Build AI infrastructure for analysis tasks</h2>
                      <span className="text-xs bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full font-medium">Requires IT</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">Data analysis, financial modeling, and compliance tasks need AI connected to internal systems</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Why this matters</h3>
                  <p className="text-sm text-neutral-600">Analysis tasks show a 30-point gap, but the barrier isn&apos;t training — it&apos;s access. Data Analysts can&apos;t use ChatGPT on proprietary data. Financial Analysts need AI that connects to your ERP. This requires IT investment, but unlocks the highest-value work: the 38,400 hours/year spent on analysis could be 60% faster with proper tooling.</p>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">254</p>
                    <p className="text-xs text-neutral-500">People affected</p>
                  </div>
                  <div className="border-b-2 border-neutral-200 p-3 text-center">
                    <p className="text-xl font-semibold text-neutral-900">1,850</p>
                    <p className="text-xs text-neutral-500">Hours/week recoverable</p>
                  </div>
                  <div className="border-b-2 border-violet-400 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">$4.3M</p>
                    <p className="text-xs text-neutral-500">Annual value</p>
                  </div>
                  <div className="border-b-2 border-violet-200 p-3 text-center">
                    <p className="text-xl font-semibold text-violet-600">16 wks</p>
                    <p className="text-xs text-neutral-500">To first results</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-900 mb-3">Action steps</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">1</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Audit data access requirements for top 5 analysis tasks</p>
                        <p className="text-xs text-neutral-500 mt-0.5">SQL queries, budget reports, compliance monitoring. Map data sources and sensitivity levels.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 1-2</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">2</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Pilot GitHub Copilot for Data team (8 users)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Low-risk starting point. Measure: time-to-complete for standard queries.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 3-6</span>
                    </div>
                    <div className="flex items-start gap-3 py-3 border-b border-neutral-100">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">3</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Evaluate enterprise AI platforms with data connectors</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Microsoft Copilot for M365, Claude for Enterprise, or custom RAG solution. RFP process.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 4-10</span>
                    </div>
                    <div className="flex items-start gap-3 py-3">
                      <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">4</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">Deploy to Finance for budget analysis pilot</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Connect AI to ERP read-only access. Start with variance analysis and forecasting support.</p>
                      </div>
                      <span className="text-xs text-neutral-400">Week 12-16</span>
                    </div>
                  </div>
                </div>

                <div className="border-l-2 border-neutral-300 pl-4 mb-6">
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">Potential blockers</h3>
                  <ul className="text-sm text-neutral-600 space-y-1">
                    <li>• Security review for data access (start early — can take 6+ weeks)</li>
                    <li>• Budget approval for enterprise licensing (~$30-50/user/month)</li>
                    <li>• IT capacity for integration work</li>
                  </ul>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <h3 className="text-sm font-medium text-neutral-900 mb-2">Success looks like</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-neutral-600">Analysis task adoption: <strong>28% → 55%</strong> in 6 months</span>
                    <span className="text-neutral-600">Query time: <strong>-40%</strong> for standard reports</span>
                    <span className="text-neutral-600">Zero security incidents</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Impact */}
            <div className="border border-neutral-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-violet-600 font-medium">Combined impact if all three succeed</p>
                  <p className="text-3xl font-semibold text-neutral-900 mt-1">$20.6M annual value</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-600">8,850 hours/week recovered</p>
                  <p className="text-sm text-neutral-600">820 employees enabled</p>
                  <p className="text-sm text-neutral-600">Gap closed from 33pts → ~12pts</p>
                </div>
              </div>
              <div className="pt-4 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  <strong className="text-neutral-900">Sequencing matters:</strong> Priority 1 builds momentum and identifies champions. Priority 2 spreads knowledge. Priority 3 removes infrastructure barriers. Don&apos;t start #3 until #1 shows results — you need the organizational buy-in.
                </p>
              </div>
            </div>

            {/* Next step callout */}
            <div className="border-b-2 border-neutral-900 py-6">
              <div className="flex items-start gap-4">
                <span className="text-2xl text-neutral-900">→</span>
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900 mb-2">Immediate next step</h3>
                  <p className="text-neutral-600 mb-4">Schedule 30-minute interviews with the 23 Admin pioneers and 31 Policy/Finance pioneers identified in this survey. They&apos;ve already solved the adoption problem — your job is to document and scale their approaches.</p>
                  <div className="flex gap-3">
                    <span className="px-3 py-1.5 bg-neutral-900 text-white rounded-full text-sm font-medium cursor-pointer hover:bg-neutral-800">Export pioneer list</span>
                    <span className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm cursor-pointer hover:bg-neutral-200">Interview template</span>
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

      {/* Footer */}
      <footer className="border-t border-neutral-100 mt-12">
        <div className="px-6 sm:px-8 max-w-5xl mx-auto py-4 flex items-center justify-between text-sm text-neutral-400">
          <span>1,847 survey responses</span>
          <span>Demo data for illustration purposes</span>
        </div>
      </footer>
    </div>
  );
}
