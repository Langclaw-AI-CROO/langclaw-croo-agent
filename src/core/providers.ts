import type {
  ProviderTraceEntry,
  ResearchInput,
  ResearchProvider,
  SourceCard,
} from "./types.js";

type FetchLike = typeof fetch;

export function createDefaultProviders(fetchImpl: FetchLike = fetch): ResearchProvider[] {
  return [
    createTavilyProvider(fetchImpl),
    createBraveProvider(fetchImpl),
    createGitHubProvider(fetchImpl),
  ];
}

export async function collectSources(
  input: ResearchInput,
  providers: ResearchProvider[]
): Promise<{ sources: SourceCard[]; providerTrace: ProviderTraceEntry[] }> {
  const sources: SourceCard[] = [];
  const providerTrace: ProviderTraceEntry[] = [];

  for (const provider of providers) {
    try {
      const result = await provider.search(input);
      sources.push(...result);
      providerTrace.push({
        provider: provider.name,
        status: result.length ? "success" : "skipped",
        message: result.length
          ? `Collected ${result.length} source cards.`
          : "No configured source cards were returned.",
        sourceCount: result.length,
      });
    } catch (error) {
      providerTrace.push({
        provider: provider.name,
        status: "failed",
        message: error instanceof Error ? error.message : "Provider failed.",
      });
    }
  }

  return {
    sources: dedupeSources(sources).slice(0, readMaxSources()),
    providerTrace,
  };
}

function createTavilyProvider(fetchImpl: FetchLike): ResearchProvider {
  return {
    name: "Tavily",
    async search(input) {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return [];
      }

      const response = await fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: buildQuery(input),
          max_results: input.maxDepth === "deep" ? 8 : 5,
          search_depth: input.maxDepth === "deep" ? "advanced" : "basic",
          include_answer: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          published_date?: string;
        }>;
      };

      return (payload.results ?? [])
        .filter((item) => item.url && item.title)
        .map((item, index) => ({
          id: `tavily-${index + 1}`,
          title: String(item.title),
          url: String(item.url),
          provider: "Tavily",
          excerpt: String(item.content ?? "").slice(0, 600),
          publishedAt: item.published_date,
        }));
    },
  };
}

function createBraveProvider(fetchImpl: FetchLike): ResearchProvider {
  return {
    name: "Brave",
    async search(input) {
      const apiKey = process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) {
        return [];
      }

      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", buildQuery(input));
      url.searchParams.set("count", input.maxDepth === "deep" ? "8" : "5");

      const response = await fetchImpl(url, {
        headers: {
          accept: "application/json",
          "x-subscription-token": apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Brave returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        web?: {
          results?: Array<{
            title?: string;
            url?: string;
            description?: string;
            age?: string;
          }>;
        };
      };

      return (payload.web?.results ?? [])
        .filter((item) => item.url && item.title)
        .map((item, index) => ({
          id: `brave-${index + 1}`,
          title: String(item.title),
          url: String(item.url),
          provider: "Brave",
          excerpt: String(item.description ?? "").slice(0, 600),
          publishedAt: item.age,
        }));
    },
  };
}

function createGitHubProvider(fetchImpl: FetchLike): ResearchProvider {
  return {
    name: "GitHub",
    async search(input) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return [];
      }

      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", `${input.topic} in:name,description,readme`);
      url.searchParams.set("per_page", input.maxDepth === "deep" ? "5" : "3");

      const response = await fetchImpl(url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        items?: Array<{
          full_name?: string;
          html_url?: string;
          description?: string | null;
          updated_at?: string;
        }>;
      };

      return (payload.items ?? [])
        .filter((item) => item.html_url && item.full_name)
        .map((item, index) => ({
          id: `github-${index + 1}`,
          title: String(item.full_name),
          url: String(item.html_url),
          provider: "GitHub",
          excerpt: String(item.description ?? "Repository match.").slice(0, 600),
          publishedAt: item.updated_at,
        }));
    },
  };
}

function buildQuery(input: ResearchInput): string {
  const parts = [input.topic];
  if (input.mode === "hackathon-fit") {
    parts.push("hackathon requirements agent commerce");
  }
  if (input.mode === "claim-verification") {
    parts.push("evidence documentation source");
  }
  if (input.chain) {
    parts.push(input.chain);
  }
  return parts.join(" ");
}

function dedupeSources(sources: SourceCard[]): SourceCard[] {
  const seen = new Set<string>();
  const result: SourceCard[] = [];

  for (const source of sources) {
    if (seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    result.push(source);
  }

  return result.map((source, index) => ({
    ...source,
    id: source.id || `source-${index + 1}`,
  }));
}

function readMaxSources(): number {
  const parsed = Number.parseInt(process.env.LANGCLAW_MAX_SOURCES ?? "8", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}
