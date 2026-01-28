import { NextRequest, NextResponse } from "next/server";
import type { SubmitTasksResponse, TaskWithData } from "@/types/survey";
import { requireSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assessmentId: providedAssessmentId, sessionId, jobTitle, occupationCode, tasks, usesAi, aiTools, aiDescription } = body as {
      assessmentId?: string;
      sessionId?: string;
      jobTitle: string;
      occupationCode?: string;
      tasks: TaskWithData[];
      usesAi?: boolean;
      aiTools?: string[];
      aiDescription?: string;
    };

    if (!jobTitle || !tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: "Job title and tasks are required" },
        { status: 400 }
      );
    }

    // Require Supabase - fail explicitly if not configured
    const supabase = requireSupabase();

    // Check for existing assessment (explicit ID or lookup by sessionId)
    let existingAssessmentId = providedAssessmentId;

    if (!existingAssessmentId && sessionId) {
      const { data: existing } = await supabase
        .from("task_assessments")
        .select("id")
        .eq("session_id", sessionId)
        .single();

      if (existing) {
        existingAssessmentId = existing.id;
      }
    }

    let finalAssessmentId: string;

    if (existingAssessmentId) {
      // UPDATE existing assessment
      const { error: updateError } = await supabase
        .from("task_assessments")
        .update({
          total_tasks: tasks.length,
          uses_ai: usesAi ?? null,
          ai_tools: aiTools || null,
        })
        .eq("id", existingAssessmentId);

      if (updateError) {
        console.error("Failed to update assessment:", updateError);
        return NextResponse.json(
          { error: "Failed to update assessment", details: updateError.message },
          { status: 500 }
        );
      }

      // DELETE old task responses
      const { error: deleteError } = await supabase
        .from("task_responses")
        .delete()
        .eq("assessment_id", existingAssessmentId);

      if (deleteError) {
        console.error("Failed to delete old task responses:", deleteError);
        // Continue anyway - we'll insert new ones
      }

      finalAssessmentId = existingAssessmentId;
      console.log("Updated existing assessment:", { assessmentId: existingAssessmentId, sessionId, taskCount: tasks.length });
    } else {
      // INSERT new assessment (original behavior)
      const assessmentData = {
        session_id: sessionId || null,
        job_title: jobTitle,
        occupation_code: occupationCode || null,
        total_tasks: tasks.length,
        uses_ai: usesAi ?? null,
        ai_tools: aiTools || null,
      };

      console.log("Inserting assessment:", { ...assessmentData, usesAi, aiTools, aiDescription });

      const { data: assessment, error: assessmentError } = await supabase
        .from("task_assessments")
        .insert(assessmentData)
        .select("id")
        .single();

      if (assessmentError) {
        console.error("Failed to create assessment:", assessmentError);
        return NextResponse.json(
          { error: "Failed to save assessment", details: assessmentError.message },
          { status: 500 }
        );
      }

      finalAssessmentId = assessment.id;
    }

    // Insert task responses
    const taskRows = tasks.map((task) => ({
      assessment_id: finalAssessmentId,
      task_id: task.id,
      user_description: task.userDescription,
      normalized_description: task.normalizedDescription,
      gwa_category: task.gwaCategory,
      onet_task_id: task.onetTaskId || null,
      onet_task_description: task.onetTaskDescription || null,
      similarity_score: task.similarityScore || null,
      task_source: task.source,
      time_percentage: task.timePercentage,
      ai_frequency: task.aiFrequency,
      ai_description: task.aiDescription || null,
    }));

    const { error: tasksError } = await supabase
      .from("task_responses")
      .insert(taskRows);

    if (tasksError) {
      console.error("Failed to save tasks:", tasksError);
      return NextResponse.json(
        { error: "Failed to save tasks" },
        { status: 500 }
      );
    }

    // Log submission for development
    console.log("Survey submission saved:", {
      assessmentId: finalAssessmentId,
      sessionId,
      jobTitle,
      taskCount: tasks.length,
    });

    const response: SubmitTasksResponse = {
      success: true,
      assessmentId: finalAssessmentId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Task submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit tasks" },
      { status: 500 }
    );
  }
}
