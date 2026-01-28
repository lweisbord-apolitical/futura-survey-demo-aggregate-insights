import { NextRequest, NextResponse } from "next/server";
import { pineconeService } from "@/lib/onet/pinecone-service";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  try {
    const hits = await pineconeService.searchJobs(title, 1);

    if (hits.length > 0) {
      return NextResponse.json({
        found: true,
        commonTitle: hits[0].fields.title,
        onetCode: hits[0].fields.code,
        onetTitle: hits[0].fields.title,
        confidence: hits[0]._score,
      });
    }

    return NextResponse.json({ found: false, message: "No matching occupation found" });
  } catch (error) {
    console.error("Job title lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup job title" },
      { status: 500 }
    );
  }
}
