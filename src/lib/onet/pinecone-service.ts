/**
 * Pinecone Service for O*NET Task Search
 *
 * Uses Pinecone's integrated embeddings to find similar O*NET tasks.
 * No separate embedding call needed - Pinecone handles it.
 */

export interface PineconeSearchHit {
  _id: string;
  _score: number;
  fields: {
    text: string;
    occupation_code: string;
    occupation_title: string;
    task_type: string;
  };
}

export interface JobSearchHit {
  _id: string;
  _score: number;
  fields: {
    code: string;
    title: string;
    description: string;
  };
}

interface PineconeSearchResponse {
  result: {
    hits: PineconeSearchHit[];
  };
}

interface JobSearchResponse {
  result: {
    hits: JobSearchHit[];
  };
}

class PineconeService {
  private apiKey: string;
  private indexHost: string;
  private jobsIndexHost: string;
  private namespace: string;

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || "";
    this.indexHost = process.env.PINECONE_INDEX_HOST || "";
    this.jobsIndexHost = "https://onet-jobs-qp0ma08.svc.aped-4627-b74a.pinecone.io";
    this.namespace = process.env.PINECONE_NAMESPACE || "__default__";
  }

  /**
   * Check if Pinecone is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.indexHost);
  }

  /**
   * Search for similar O*NET tasks using integrated embeddings
   */
  async searchSimilar(
    query: string,
    topK: number = 5,
    filter?: Record<string, unknown>
  ): Promise<PineconeSearchHit[]> {
    if (!this.isConfigured()) {
      console.warn("[Pinecone] Not configured - missing API key or host");
      return [];
    }

    try {
      const url = `${this.indexHost}/records/namespaces/${this.namespace}/search`;

      // Build query object with optional filter inside
      const queryObj: Record<string, unknown> = {
        inputs: { text: query },
        top_k: topK,
      };

      if (filter) {
        queryObj.filter = filter;
      }

      const body: Record<string, unknown> = {
        query: queryObj,
        fields: ["text", "occupation_code", "occupation_title", "task_type"],
      };

      console.log("[Pinecone] Request URL:", url);
      console.log("[Pinecone] Request body:", JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
          "X-Pinecone-API-Version": "2025-04",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Pinecone] Search failed: ${response.status} - ${errorText}`);
        return [];
      }

      const data = await response.json();
      console.log("[Pinecone] Raw response:", JSON.stringify(data, null, 2).slice(0, 500));

      const typedData = data as PineconeSearchResponse;
      return typedData.result?.hits || [];
    } catch (error) {
      console.error("[Pinecone] Search error:", error);
      return [];
    }
  }

  /**
   * Search similar tasks filtered by occupation code
   */
  async searchByOccupation(
    query: string,
    occupationCode: string,
    topK: number = 5
  ): Promise<PineconeSearchHit[]> {
    return this.searchSimilar(query, topK, {
      occupation_code: { $eq: occupationCode },
    });
  }

  /**
   * Search for O*NET occupations by job title using semantic matching
   * Uses the onet-jobs index
   */
  async searchJobs(jobTitle: string, topK: number = 1): Promise<JobSearchHit[]> {
    if (!this.apiKey) {
      console.warn("[Pinecone] Not configured - missing API key");
      return [];
    }

    try {
      const url = `${this.jobsIndexHost}/records/namespaces/${this.namespace}/search`;

      const body = {
        query: {
          inputs: { text: jobTitle },
          top_k: topK,
        },
        fields: ["code", "title", "description"],
      };

      console.log("[Pinecone Jobs] Searching for:", jobTitle);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
          "X-Pinecone-API-Version": "2025-04",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Pinecone Jobs] Search failed: ${response.status} - ${errorText}`);
        return [];
      }

      const data = await response.json();
      const typedData = data as JobSearchResponse;
      const hits = typedData.result?.hits || [];

      if (hits.length > 0) {
        console.log(`[Pinecone Jobs] Best match: ${hits[0].fields.title} (score: ${hits[0]._score})`);
      }

      return hits;
    } catch (error) {
      console.error("[Pinecone Jobs] Search error:", error);
      return [];
    }
  }
}

// Export singleton
export const pineconeService = new PineconeService();
