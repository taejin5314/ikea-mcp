import { ZodError } from "zod";

/** A tool result that tells the model what went wrong, instead of a protocol error the client may hide. */
export interface ToolErrorResult {
  [key: string]: unknown;
  isError: true;
  content: { type: "text"; text: string }[];
}

function describeIssues(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const where = issue.path.length ? issue.path.join(".") : "input";
      return `${where}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Turns anything a tool handler threw into a tool result with isError set.
 * Invalid input names the field so the model can correct the call; anything else is reported as an upstream failure.
 */
export function toToolError(toolName: string, err: unknown): ToolErrorResult {
  let text: string;
  if (err instanceof ZodError) {
    text = `Invalid input for ${toolName}: ${describeIssues(err)}. Fix the arguments and call the tool again.`;
  } else if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    text = `${toolName} failed: the IKEA API did not answer in time. Try again shortly.`;
  } else {
    const message = err instanceof Error ? err.message : String(err);
    text = `${toolName} failed: ${message}. The IKEA API may be unavailable or may have changed; try again shortly.`;
  }
  return { isError: true, content: [{ type: "text", text }] };
}
