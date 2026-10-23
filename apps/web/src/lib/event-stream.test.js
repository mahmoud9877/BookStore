import { createSseParser, keepEventStreamOpen, MAX_RETRY_MS } from "./event-stream.js";

const collect = () => {
  const events = [];
  return { events, parser: createSseParser((event) => events.push(event)) };
};

test("parses events split across chunks, including mid-line", () => {
  const { events, parser } = collect();
  parser.push("event: unr");
  parser.push('ead\ndata: {"unr');
  parser.push('ead": 2}\n');
  expect(events).toEqual([]);
  parser.push("\n");
  expect(events).toEqual([{ event: "unread", data: '{"unread": 2}', id: undefined }]);
});

test("parses several events in one chunk, skips comments and handles CRLF", () => {
  const { events, parser } = collect();
  parser.push(': ping\n\nevent: notification\r\ndata: {"_id":"n1"}\r\n\r\nevent: unread\ndata: {"unread":1}\n\n: ping\n\n');
  expect(events.map(({ event, data }) => [event, data])).toEqual([
    ["notification", '{"_id":"n1"}'],
    ["unread", '{"unread":1}'],
  ]);
});

test("joins multi-line data, defaults the event name and keeps a CR split from its LF", () => {
  const { events, parser } = collect();
  parser.push("data: a\r");
  parser.push("\ndata:b\n\r");
  parser.push("\n");
  expect(events).toEqual([{ event: "message", data: "a\nb", id: undefined }]);
});

describe("keepEventStreamOpen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };

  test("reconnects with growing backoff that resets after a successful connection", async () => {
    let attempt = 0;
    const open = jest.fn(async ({ onOpen }) => {
      attempt += 1;
      if (attempt === 3) onOpen(); // the third attempt connects, then drops
      throw new Error("network");
    });
    const stop = keepEventStreamOpen({ getRequest: () => ({ url: "/s" }), onEvent: jest.fn(), open });
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(999);
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1); // 1s
    await flush();
    expect(open).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(2000); // 2s
    await flush();
    expect(open).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(1000); // reset to 1s after connecting
    await flush();
    expect(open).toHaveBeenCalledTimes(4);
    stop();
    jest.advanceTimersByTime(MAX_RETRY_MS);
    await flush();
    expect(open).toHaveBeenCalledTimes(4);
  });

  test("never waits more than 30 seconds between attempts", async () => {
    const open = jest.fn(async () => {
      throw new Error("network");
    });
    const stop = keepEventStreamOpen({ getRequest: () => ({ url: "/s" }), onEvent: jest.fn(), open });
    for (let i = 0; i < 8; i += 1) {
      await flush();
      jest.advanceTimersByTime(MAX_RETRY_MS);
    }
    await flush();
    expect(open).toHaveBeenCalledTimes(9);
    stop();
  });

  test("stops for good on 401", async () => {
    const onUnauthorized = jest.fn();
    const open = jest.fn(async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    });
    keepEventStreamOpen({ getRequest: () => ({ url: "/s" }), onEvent: jest.fn(), onUnauthorized, open });
    await flush();
    jest.advanceTimersByTime(5 * MAX_RETRY_MS);
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
