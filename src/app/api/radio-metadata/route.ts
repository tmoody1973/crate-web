/**
 * Radio ICY metadata endpoint.
 * Connects to a radio stream with Icy-MetaData header to extract
 * the current artist/song playing on the station.
 */

/** Reject URLs pointing to internal/private networks (SSRF protection). */
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower === "[::1]") return true;
  if (lower === "metadata.google.internal" || lower === "169.254.169.254") return true;
  // IPv4 private ranges
  const ipv4Match = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 0) return true;                           // 0.0.0.0/8
  }
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const streamUrl = searchParams.get("url");

  if (!streamUrl) {
    return Response.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    const parsed = new URL(streamUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return Response.json({ error: "Invalid stream URL" }, { status: 400 });
    }
    if (isPrivateHost(parsed.hostname)) {
      return Response.json({ error: "Private/internal URLs are not allowed" }, { status: 403 });
    }

    // Request ICY metadata from the stream
    const res = await fetch(streamUrl, {
      headers: {
        "Icy-MetaData": "1",
        "User-Agent": "Crate/1.0.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok || !res.body) {
      return Response.json({ error: "Stream not reachable" }, { status: 502 });
    }

    const icyMetaInt = parseInt(res.headers.get("icy-metaint") || "0", 10);

    if (!icyMetaInt) {
      // No ICY metadata support — return station headers instead
      const name = res.headers.get("icy-name") || null;
      const genre = res.headers.get("icy-genre") || null;
      // Clean up by aborting the stream
      try { res.body.cancel(); } catch { /* ignore */ }
      return Response.json({ title: name, artist: null, genre });
    }

    // Read enough bytes to get the first metadata block
    const reader = res.body.getReader();
    let bytesRead = 0;
    const chunks: Uint8Array[] = [];

    try {
      while (bytesRead < icyMetaInt + 4096) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytesRead += value.length;

        // Once we have enough data past icyMetaInt, extract metadata
        if (bytesRead > icyMetaInt) {
          const allData = new Uint8Array(bytesRead);
          let offset = 0;
          for (const chunk of chunks) {
            allData.set(chunk, offset);
            offset += chunk.length;
          }

          // Metadata length byte is at position icyMetaInt
          const metaLength = allData[icyMetaInt] * 16;
          if (metaLength > 0 && bytesRead >= icyMetaInt + 1 + metaLength) {
            const metaBytes = allData.slice(icyMetaInt + 1, icyMetaInt + 1 + metaLength);
            const metaString = new TextDecoder().decode(metaBytes).replace(/\0+$/, "");

            // Parse StreamTitle='Artist - Title';
            // Use greedy match up to the closing '; to avoid capturing other ICY fields
            const match = metaString.match(/StreamTitle='([^']*?)';/);
            if (match) {
              const streamTitle = match[1]?.trim() ?? "";
              // Skip empty titles or titles that look like protocol garbage
              if (streamTitle && !streamTitle.includes("StreamUrl") && !streamTitle.includes("StreamUrl=")) {
                const parts = streamTitle.split(" - ");
                reader.cancel();
                return Response.json({
                  title: parts.length > 1 ? parts.slice(1).join(" - ") : streamTitle,
                  artist: parts.length > 1 ? parts[0]?.trim() : null,
                  raw: streamTitle,
                });
              }
            }
          }
          // If we're well past the expected metadata position, stop
          if (bytesRead > icyMetaInt + 8192) break;
        }
      }
    } finally {
      reader.cancel();
    }

    // No metadata found
    const name = res.headers.get("icy-name") || null;
    return Response.json({ title: name, artist: null });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
