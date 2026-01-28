import { NextRequest, NextResponse } from "next/server";
import { pineconeService } from "@/lib/onet/pinecone-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || searchParams.get("query");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const hits = await pineconeService.searchJobs(query, limit);
    const results = hits.map(hit => ({
      commonTitle: hit.fields.title,
      onetCode: hit.fields.code,
      onetTitle: hit.fields.title,
      confidence: hit._score,
    }));

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error("Job title search error:", error);
    return NextResponse.json(
      { error: "Failed to search job titles" },
      { status: 500 }
    );
  }
}
