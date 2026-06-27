import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const profiles = [
  { id: "phantom", url: "https://senkuro.com/users/phantom" },
  { id: "imperator", url: "https://senkuro.com/users/imperator" }
];

const outDir = path.join("assets", "data", "profile-snippets");

const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

function extractBalanced(html, needle) {
  const start = html.indexOf(needle);
  if (start < 0) {
    throw new Error(`Cannot find ${needle}`);
  }

  const tagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>/g;
  tagPattern.lastIndex = start;

  let depth = 0;
  let opened = false;

  for (const match of html.slice(start).matchAll(tagPattern)) {
    const full = match[0];
    const name = match[1].toLowerCase();
    const absoluteIndex = start + match.index;
    const closing = full.startsWith("</");
    const selfClosing = full.endsWith("/>") || voidTags.has(name);

    if (!closing) {
      opened = true;
      if (!selfClosing) depth += 1;
    } else if (!selfClosing) {
      depth -= 1;
    }

    if (opened && depth === 0) {
      return html.slice(start, absoluteIndex + full.length);
    }
  }

  throw new Error(`Unbalanced HTML for ${needle}`);
}

function extractTitle(html) {
  return html.match(/<title>(.*?)<\/title>/)?.[1] || "";
}

function extractBetween(html, startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle);
  const end = html.indexOf(endNeedle, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Cannot extract range ${startNeedle} ... ${endNeedle}`);
  }
  return html.slice(start, end);
}

async function fetchSnapshot(profile) {
  let response;
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(profile.url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          "user-agent": "Mozilla/5.0 Senkuro cosmetics preview snapshot"
        }
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError;
  }

  if (!response.ok) {
    throw new Error(`${profile.url}: ${response.status}`);
  }

  const html = await response.text();
  const header = extractBetween(html, '<header class="header"', '<div class="client">');
  const client = extractBetween(html, '<div class="client">', '<div class="nav-bar">');
  const navBar = extractBetween(html, '<div class="nav-bar">', '<footer class="footer"');
  const title = extractTitle(html);

  return `<!-- Source: ${profile.url} -->\n<!-- Title: ${title} -->\n${header}${client}${navBar}\n`;
}

await mkdir(outDir, { recursive: true });

for (const profile of profiles) {
  const snapshot = await fetchSnapshot(profile);
  const target = path.join(outDir, `${profile.id}.html`);
  await writeFile(target, snapshot);
  console.log(`${profile.id}: ${snapshot.length} bytes`);
}
