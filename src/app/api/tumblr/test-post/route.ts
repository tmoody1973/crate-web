import { auth } from "@clerk/nextjs/server";
import { getTokenVaultToken, isTokenVaultConfigured } from "@/lib/auth0-token-vault";
import { markdownToNpf } from "@/lib/web-tools/tumblr";

/**
 * Debug endpoint — test Tumblr posting with a simple test post.
 * GET /api/tumblr/test-post — creates a real test post on tarik-crate.
 */
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({ error: "Token Vault not configured" }, { status: 503 });
  }

  // Read Auth0 user ID from cookie
  const cookies = req.headers.get("cookie") ?? "";
  const perService = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id_tumblr="));
  let auth0UserId: string | undefined;
  if (perService) {
    const raw = perService.split("=").slice(1).join("=").trim();
    auth0UserId = raw ? decodeURIComponent(raw) : undefined;
  }
  if (!auth0UserId) {
    const global = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id="));
    if (global) {
      const raw = global.split("=").slice(1).join("=").trim();
      auth0UserId = raw ? decodeURIComponent(raw) : undefined;
    }
  }

  if (!auth0UserId) {
    return Response.json({ error: "No tumblr cookie" }, { status: 400 });
  }

  const token = await getTokenVaultToken("tumblr", auth0UserId);
  if (!token) {
    return Response.json({ error: "No token from Token Vault" }, { status: 404 });
  }

  // Step 1: Get blog name
  const infoRes = await fetch("https://api.tumblr.com/v2/user/info", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const infoText = await infoRes.text();

  if (!infoRes.ok) {
    return Response.json({ error: "user/info failed", status: infoRes.status, body: infoText });
  }

  const infoData = JSON.parse(infoText);
  const blogs = infoData.response?.user?.blogs ?? [];
  const blog = blogs.find((b: { name: string }) => b.name === "tarik-crate") ?? blogs[0];

  if (!blog) {
    return Response.json({ error: "No blog found", blogs });
  }

  // Step 2: Create a simple test post
  const testContent = "## Test Post from Crate\n\nThis is a test post to verify the Tumblr API integration.\n\n- Item one\n- Item two\n- **Bold item**\n\nPosted via Crate at digcrate.app";
  const npfBlocks = markdownToNpf(testContent);
  const contentBlocks = [
    { type: "text", subtype: "heading1", text: "Crate Integration Test" },
    ...npfBlocks,
  ];

  const postBody = {
    content: contentBlocks,
    tags: "crate,test",
    state: "published",
  };

  const postRes = await fetch(`https://api.tumblr.com/v2/blog/${blog.name}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });

  const postText = await postRes.text();

  // Try to extract post ID
  const stringIdMatch = postText.match(/"id"\s*:\s*"(\d+)"/);
  const numIdMatch = postText.match(/"id"\s*:\s*(\d{10,})/);
  const postId = stringIdMatch?.[1] ?? numIdMatch?.[1] ?? "not_found";

  return Response.json({
    blogName: blog.name,
    postStatus: postRes.status,
    postId,
    postUrl: postId !== "not_found" ? `https://www.tumblr.com/${blog.name}/${postId}` : null,
    rawResponse: postText.slice(0, 1000),
    sentBody: postBody,
    npfBlockCount: contentBlocks.length,
  });
}
