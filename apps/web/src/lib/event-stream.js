/*
 * Server-Sent Events over fetch(). EventSource can't send an authorization
 * header, so the stream is opened with fetch and its body parsed as
 * `text/event-stream` here.
 */

/**
 * An incremental SSE parser. `push(text)` accepts chunks that may end mid-line;
 * each complete event (blank-line terminated) calls `onEvent({ event, data, id })`.
 * Lines starting with ":" are comments (heartbeats) and are ignored.
 */
export function createSseParser(onEvent) {
  let buffer = "";
  let event = "";
  let data = [];
  let id;

  const dispatch = () => {
    if (data.length) onEvent({ event: event || "message", data: data.join("\n"), id });
    event = "";
    data = [];
  };

  const line = (text) => {
    if (text === "") return dispatch();
    if (text.startsWith(":")) return undefined;
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
    return undefined;
  };

  return {
    push(chunk) {
      buffer += chunk;
      // Lines end with \n, \r\n or \r; a trailing \r may be the first half of \r\n.
      let match;
      const pattern = /\r\n|\n|\r(?!$)/g;
      let start = 0;
      while ((match = pattern.exec(buffer))) {
        line(buffer.slice(start, match.index));
        start = match.index + match[0].length;
      }
      buffer = buffer.slice(start);
    },
  };
}

/** Raised when the stream can't be opened; `status` is the HTTP status (if any). */
export class StreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Opens one stream and reads it until it ends. Calls `onOpen()` once the server
 * accepted it and `onEvent(event)` per event. Resolves when the server closes the
 * stream; rejects with a StreamError on an HTTP error (or the fetch/abort error).
 */
export async function openEventStream({ url, headers, signal, onOpen, onEvent }) {
  // No streaming fetch (very old browsers, the jsdom test DOM): never connect, and
  // never retry; the callers' polling still works.
  if (typeof fetch !== "function" || typeof TextDecoder !== "function") return new Promise(() => {});
  const response = await fetch(url, { headers: { accept: "text/event-stream", ...headers }, signal, cache: "no-store" });
  if (!response.ok || !response.body) throw new StreamError(`Stream request failed (${response.status})`, response.status);
  onOpen?.();
  const parser = createSseParser(onEvent);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
}

export const MIN_RETRY_MS = 1000;
export const MAX_RETRY_MS = 30_000;

/**
 * Keeps a stream open: reconnects with exponential backoff (1s → 30s, back to 1s
 * after a successful connection) whenever it ends or fails, except on 401 (the
 * session ended: `onUnauthorized()` is called and it stops). Returns `stop()`.
 * `open` is the transport (openEventStream; replaced in tests). `getRequest()`
 * returns `{ url, headers }` for each attempt.
 */
export function keepEventStreamOpen({ getRequest, onEvent, onUnauthorized, open = openEventStream }) {
  const controller = new AbortController();
  let delay = MIN_RETRY_MS;
  let timer = null;

  const connect = async () => {
    if (controller.signal.aborted) return;
    try {
      await open({ ...getRequest(), signal: controller.signal, onEvent, onOpen: () => (delay = MIN_RETRY_MS) });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error?.status === 401) {
        onUnauthorized?.();
        return;
      }
    }
    if (controller.signal.aborted) return;
    timer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, MAX_RETRY_MS);
  };

  connect();
  return function stop() {
    controller.abort();
    clearTimeout(timer);
  };
}
