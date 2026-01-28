import { NextRequest, NextResponse } from "next/server";
import { pineconeService } from "@/lib/onet/pinecone-service";
import type { GWACategory } from "@/types/survey";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobTitle = searchParams.get("jobTitle");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 6;

    if (!jobTitle) {
      return NextResponse.json(
        { error: "jobTitle parameter is required" },
        { status: 400 }
      );
    }

    // Use Pinecone semantic matching
    // Step 1: Find best matching O*NET occupation via Pinecone onet-jobs index
    // Step 2: Get tasks from Pinecone tasks index filtered by occupation_code
    const jobHits = await pineconeService.searchJobs(jobTitle, 1);

    if (jobHits.length > 0 && jobHits[0]._score >= 0.3) {
      const matchedOccupationCode = jobHits[0].fields.code;
      const matchedOccupationTitle = jobHits[0].fields.title;

      // Always use Pinecone tasks index with occupation_code filter
      const taskHits = await pineconeService.searchByOccupation(
        jobTitle, // Use job title as query for semantic task search
        matchedOccupationCode,
        limit
      );

      const suggestions = taskHits.map(hit => ({
        id: hit._id,
        statement: hit.fields.text,
        occupationCode: hit.fields.occupation_code,
        occupationTitle: hit.fields.occupation_title,
        gwaCategory: hit.fields.task_type as GWACategory,
        importance: 0,
      }));

      return NextResponse.json({
        tasks: suggestions,
        count: suggestions.length,
        matched: suggestions.length > 0,
        matchedOccupation: {
          code: matchedOccupationCode,
          title: matchedOccupationTitle,
          score: jobHits[0]._score,
        },
      });
    }

    // Score below threshold - return empty with matched: false
    return NextResponse.json({
      tasks: [],
      count: 0,
      matched: false,
    });
  } catch (error) {
    console.error("O*NET suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to get task suggestions" },
      { status: 500 }
    );
  }
}
