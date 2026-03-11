/**
 * Custom StreamProtocolAdapter that converts CrateAgent SSE events
 * into AG-UI events that OpenUI understands.
 */
import { EventType } from "@ag-ui/core";
import type { StreamProtocolAdapter, AGUIEvent } from "@openuidev/react-headless";

/** Parse CrateEvent SSE stream into AG-UI events for OpenUI. */
export function crateStreamAdapter(): StreamProtocolAdapter {
  return {
    async *parse(response: Response): AsyncIterable<AGUIEvent> {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let messageStarted = false;
      const messageId = crypto.randomUUID();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          switch (event.type) {
            case "answer_token": {
              if (!messageStarted) {
                messageStarted = true;
                yield {
                  type: EventType.TEXT_MESSAGE_START,
                  messageId,
                  role: "assistant",
                } as AGUIEvent;
              }
              yield {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: event.token as string,
              } as AGUIEvent;
              break;
            }

            case "tool_start": {
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId: `${event.server}__${event.tool}__${Date.now()}`,
                toolCallName: `${event.server}: ${event.tool}`,
              } as AGUIEvent;
              break;
            }

            case "tool_end": {
              yield {
                type: EventType.TOOL_CALL_END,
                toolCallId: `${event.server}__${event.tool}`,
              } as AGUIEvent;
              break;
            }

            case "error": {
              // Emit error as text content
              if (!messageStarted) {
                messageStarted = true;
                yield {
                  type: EventType.TEXT_MESSAGE_START,
                  messageId,
                  role: "assistant",
                } as AGUIEvent;
              }
              yield {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: `Error: ${event.message}`,
              } as AGUIEvent;
              break;
            }

            case "done": {
              // End the message
              break;
            }
          }
        }
      }

      // Close the message if one was started
      if (messageStarted) {
        yield {
          type: EventType.TEXT_MESSAGE_END,
          messageId,
        } as AGUIEvent;
      }
    },
  };
}
