import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(__dirname, "../assets/data/collectibles.generated.json");

const endpoint = "https://api.senkuro.com/graphql";
const persistedQueryHash = "e0035214ce75614fa374dc898b1f73df98868783f02ffb9803972d2b6e2a8b72";
const types = ["AVATAR", "FRAME", "BANNER", "WALLPAPER"];

const baseVariables = {
  excludePurchased: false,
  first: 100,
  onlyLimited: false,
  onlyWithSubscription: false,
  orderBy: { direction: "DESC", field: "CREATED_AT" },
  priceGroup: null,
  rating: { exclude: [], include: [] },
  visible: true
};

const result = {
  generatedAt: new Date().toISOString(),
  source: endpoint,
  items: {
    AVATAR: [],
    FRAME: [],
    BANNER: [],
    WALLPAPER: []
  }
};

for (const type of types) {
  result.items[type] = await fetchType(type);
  console.log(`${type}: ${result.items[type].length}`);
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Wrote ${outFile}`);

async function fetchType(type) {
  const items = [];
  let after = null;
  let page = 0;

  while (page < 50) {
    page += 1;
    const payload = {
      extensions: {
        persistedQuery: {
          sha256Hash: persistedQueryHash,
          version: 1
        }
      },
      operationName: "fetchCollectibles",
      variables: {
        ...baseVariables,
        after,
        type
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/graphql-response+json, application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`GraphQL ${type} failed with HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(`GraphQL ${type} failed: ${json.errors.map((error) => error.message).join("; ")}`);
    }

    const connection = json.data?.collectibles;
    if (!connection) {
      throw new Error(`GraphQL ${type} response did not include collectibles`);
    }

    for (const edge of connection.edges || []) {
      const normalized = normalizeItem(edge.node);
      if (normalized) items.push(normalized);
    }

    const pageInfo = connection.pageInfo || {};
    after = pageInfo.endCursor || connection.edges?.at(-1)?.cursor || null;
    if (!pageInfo.hasNextPage || !after) break;
  }

  return items;
}

function normalizeItem(node) {
  if (!node) return null;
  const image = node.image || {};
  const original = image.original?.url || null;
  const variants = (image.variants || []).map((variant) => ({
    width: variant.width || null,
    height: variant.height || null,
    format: variant.format || null,
    codec: variant.codec || null,
    url: variant.url
  })).filter((variant) => variant.url);

  return {
    id: node.id,
    slug: node.slug,
    title: titleFor(node.titles),
    type: node.type,
    rating: node.rating,
    visible: node.visible,
    recent: node.recent,
    animation: Boolean(image.animation),
    original,
    variants,
    createdAt: node.createdAt
  };
}

function titleFor(titles = []) {
  return titles.find((title) => title.lang === "RU")?.content
    || titles.find((title) => title.lang === "EN")?.content
    || titles[0]?.content
    || "";
}
