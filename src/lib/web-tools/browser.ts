/**
 * Web-compatible cloud browser tools powered by Kernel.sh.
 * Thin CrateToolDef wrappers around crate-cli's withBrowser utility.
 *
 * Enables the agent to read full articles and take screenshots from
 * sources that block simple HTTP fetches (Pitchfork, RYM, Resident Advisor, etc.).
 *
 * Requires KERNEL_API_KEY — withBrowser connects to Kernel's remote Chromium via CDP.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const MAX_CONTENT_LENGTH = 15_000;
const NAVIGATE_TIMEOUT_MS = 30_000;

/** CSS selectors for common music publication article containers. */
const ARTICLE_SELECTORS = [
  "article",
  '[role="article"]',
  ".review-body",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".story-body",
  ".article__body",
  ".article-content",
  ".body-text",
  "main",
];

/** Elements to strip when falling back to full-page text extraction. */
const STRIP_SELECTORS = [
  "nav", "header", "footer", "aside",
  "script", "style", "noscript", "iframe",
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  ".ad", ".ads", ".advertisement", ".sidebar",
  ".cookie-banner", ".newsletter-signup", ".popup",
];

function toolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(msg: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
}

export function createBrowserTools(): CrateToolDef[] {
  return [
    {
      name: "browse_url",
      description:
        "Navigate to a URL using a cloud browser and extract the page content. " +
        "Use for reading full articles, reviews, and pages that block simple HTTP requests. " +
        "Best for music publications (Pitchfork, Resident Advisor, RYM, etc.) and pages with anti-bot protection.",
      inputSchema: {
        url: z.string().url().describe("The URL to navigate to"),
        wait_for: z
          .string()
          .max(200)
          .optional()
          .describe("Optional CSS selector to wait for before extracting content"),
      },
      handler: async (args: { url: string; wait_for?: string }, _extra: unknown) => {
        const { withBrowser } = await import("crate-cli/dist/servers/browser.js");

        try {
          return await withBrowser(async (page: import("playwright-core").Page) => {
            await page.goto(args.url, {
              waitUntil: "domcontentloaded",
              timeout: NAVIGATE_TIMEOUT_MS,
            });

            if (args.wait_for) {
              await page.waitForSelector(args.wait_for, { timeout: 10_000 }).catch(() => {});
            } else {
              await page.waitForTimeout(2000);
            }

            const title = await page.title();

            const meta = await page.evaluate(() => {
              const get = (name: string) => {
                const el =
                  document.querySelector(`meta[property="${name}"]`) ??
                  document.querySelector(`meta[name="${name}"]`);
                return el?.getAttribute("content") ?? "";
              };
              return {
                description: get("og:description") || get("description"),
                author: get("author") || get("article:author"),
                published: get("article:published_time") || get("date"),
                siteName: get("og:site_name"),
              };
            });

            // Try article selectors first
            let content = "";
            for (const selector of ARTICLE_SELECTORS) {
              const text = await page.evaluate((sel: string) => {
                const el = document.querySelector(sel);
                return el ? el.textContent?.trim() ?? "" : "";
              }, selector);
              if (text.length > 200) {
                content = text.slice(0, MAX_CONTENT_LENGTH);
                break;
              }
            }

            // Fallback: strip noise, return body text
            if (!content) {
              content = await page.evaluate((stripSels: string[]) => {
                for (const sel of stripSels) {
                  document.querySelectorAll(sel).forEach((el) => el.remove());
                }
                return document.body?.textContent?.trim() ?? "";
              }, STRIP_SELECTORS);
              content = content.slice(0, MAX_CONTENT_LENGTH);
            }

            return toolResult({
              url: page.url(),
              title,
              meta,
              contentLength: content.length,
              content,
            });
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      },
    },
    {
      name: "screenshot_url",
      description:
        "Take a screenshot of a web page using a cloud browser. " +
        "Returns the screenshot as base64 image data. " +
        "Useful for capturing visual layouts, charts, or pages where text extraction isn't enough.",
      inputSchema: {
        url: z.string().url().describe("The URL to screenshot"),
        full_page: z
          .boolean()
          .optional()
          .describe("Capture full scrollable page instead of viewport (default false)"),
        selector: z
          .string()
          .max(200)
          .optional()
          .describe("CSS selector of a specific element to screenshot"),
      },
      handler: async (args: { url: string; full_page?: boolean; selector?: string }, _extra: unknown) => {
        const { withBrowser } = await import("crate-cli/dist/servers/browser.js");

        try {
          return await withBrowser(async (page: import("playwright-core").Page) => {
            await page.goto(args.url, {
              waitUntil: "domcontentloaded",
              timeout: NAVIGATE_TIMEOUT_MS,
            });
            await page.waitForTimeout(2000);

            let screenshotBuffer: Buffer;
            if (args.selector) {
              const el = await page.$(args.selector);
              if (!el) {
                return toolError(`Element not found: ${args.selector}`);
              }
              screenshotBuffer = await el.screenshot({ type: "png" }) as Buffer;
            } else {
              screenshotBuffer = await page.screenshot({
                type: "png",
                fullPage: args.full_page ?? false,
              }) as Buffer;
            }

            const base64 = screenshotBuffer.toString("base64");
            const title = await page.title();

            return {
              content: [
                {
                  type: "image" as const,
                  data: base64,
                  mimeType: "image/png",
                },
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    url: page.url(),
                    title,
                    screenshotSize: `${Math.round(screenshotBuffer.length / 1024)}KB`,
                  }),
                },
              ],
            };
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      },
    },
  ];
}
