/**
 * Convert markdown content into Slack Block Kit blocks.
 * Handles: headers, bold, tables, bullet lists, numbered lists, dividers, links, quotes.
 * Slack uses *bold*, _italic_, ~strikethrough~, and doesn't support markdown tables.
 */

/** Convert **bold** to *bold* (Slack format) and _italic_ stays the same */
function slackifyText(text: string): string {
  // **bold** → *bold*
  let result = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
  // Remove any remaining double asterisks
  result = result.replace(/\*\*/g, "*");
  return result;
}

/** Parse a markdown table into an array of row objects */
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  const separatorLine = lines[1];

  // Verify it's a table (has pipes and separator row with dashes)
  if (!headerLine.includes("|") || !/^[\s|:-]+$/.test(separatorLine)) return null;

  const parseCells = (line: string) =>
    line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);

  const headers = parseCells(headerLine);
  const rows = lines.slice(2).map(parseCells).filter((r) => r.length > 0);

  return { headers, rows };
}

/** Convert a parsed table into a Slack native table block */
function tableToBlocks(table: { headers: string[]; rows: string[][] }): unknown[] {
  // Build rows array: first row is headers, rest are data
  const headerRow = table.headers.map((h) => ({
    type: "raw_text" as const,
    text: slackifyText(h),
  }));

  const dataRows = table.rows.map((row) =>
    row.map((cell) => ({
      type: "raw_text" as const,
      text: slackifyText(cell),
    })),
  );

  // Column settings — wrap text for all columns
  const columnSettings = table.headers.map(() => ({
    is_wrapped: true,
  }));

  return [
    {
      type: "table",
      column_settings: columnSettings,
      rows: [headerRow, ...dataRows].slice(0, 100), // Slack max 100 rows
    },
  ];
}

export function contentToBlocks(content: string, title?: string): unknown[] {
  const blocks: unknown[] = [];

  // Header block
  if (title) {
    blocks.push({
      type: "header",
      text: { type: "plain_text", text: title.slice(0, 150) },
    });
  }

  const lines = content.split("\n");
  let currentSection: string[] = [];
  let currentList: string[] = [];
  let currentNumberedList: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  function flushSection() {
    if (currentSection.length > 0) {
      const text = slackifyText(currentSection.join("\n").trim());
      if (text) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: text.slice(0, 3000) },
        });
      }
      currentSection = [];
    }
  }

  function flushList() {
    if (currentList.length > 0) {
      blocks.push({
        type: "rich_text",
        elements: [
          {
            type: "rich_text_list",
            style: "bullet",
            elements: currentList.map((item) => ({
              type: "rich_text_section",
              elements: [{ type: "text", text: slackifyText(item) }],
            })),
          },
        ],
      });
      currentList = [];
    }
  }

  function flushNumberedList() {
    if (currentNumberedList.length > 0) {
      blocks.push({
        type: "rich_text",
        elements: [
          {
            type: "rich_text_list",
            style: "ordered",
            elements: currentNumberedList.map((item) => ({
              type: "rich_text_section",
              elements: [{ type: "text", text: slackifyText(item) }],
            })),
          },
        ],
      });
      currentNumberedList = [];
    }
  }

  function flushTable() {
    if (tableLines.length > 0) {
      const table = parseTable(tableLines);
      if (table) {
        blocks.push(...tableToBlocks(table));
      }
      tableLines = [];
      inTable = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table start (line with pipes)
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      if (!inTable) {
        flushSection();
        flushList();
        flushNumberedList();
        inTable = true;
      }
      tableLines.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers (## or ###)
    if (/^#{1,3}\s/.test(trimmed)) {
      flushSection();
      flushList();
      flushNumberedList();
      const headerText = trimmed.replace(/^#{1,3}\s+/, "");
      blocks.push({
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              { type: "text", text: headerText, style: { bold: true } },
            ],
          },
        ],
      });
      continue;
    }

    // Bullet list items (- or * at start)
    if (/^[-*]\s/.test(trimmed)) {
      flushSection();
      flushNumberedList();
      currentList.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Numbered list items (1. 2. 3.)
    if (/^\d+\.\s/.test(trimmed)) {
      flushSection();
      flushList();
      currentNumberedList.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Blockquotes (>)
    if (trimmed.startsWith(">")) {
      flushSection();
      flushList();
      flushNumberedList();
      const quoteText = trimmed.replace(/^>\s*/, "");
      blocks.push({
        type: "rich_text",
        elements: [
          {
            type: "rich_text_quote",
            elements: [{ type: "text", text: slackifyText(quoteText) }],
          },
        ],
      });
      continue;
    }

    // Dividers (--- or ***)
    if (/^[-*]{3,}$/.test(trimmed)) {
      flushSection();
      flushList();
      flushNumberedList();
      blocks.push({ type: "divider" });
      continue;
    }

    // Empty line = paragraph break
    if (!trimmed) {
      flushList();
      flushNumberedList();
      flushSection();
      continue;
    }

    // Regular text
    flushList();
    flushNumberedList();
    currentSection.push(line);
  }

  flushTable();
  flushSection();
  flushList();
  flushNumberedList();

  // Crate footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Sent from <https://digcrate.app|Crate> — AI music research" },
    ],
  });

  return blocks;
}
