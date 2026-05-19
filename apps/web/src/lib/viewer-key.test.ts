import { describe, expect, test, beforeEach } from "bun:test";
import { generateViewerKeyPair, persistViewerKey, loadViewerKey } from "./viewer-key";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  // @ts-expect-error — mock localStorage for bun test environment
  globalThis.window = {
    localStorage: {
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      getItem: (k: string) => mockStorage[k] ?? null,
      removeItem: (k: string) => { delete mockStorage[k]; },
    },
  };
});

describe("viewer-key", () => {
  test("generateViewerKeyPair returns valid keys", () => {
    const key = generateViewerKeyPair();
    expect(key.x).toBeTruthy();
    expect(key.y).toBeTruthy();
    expect(key.privateKey).toBeTruthy();
    expect(typeof key.x).toBe("string");
    expect(typeof key.y).toBe("string");
    expect(typeof key.privateKey).toBe("string");
  });

  test("persist and load round-trip", () => {
    const key = generateViewerKeyPair();
    persistViewerKey("0x1234567890123456789012345678901234567890", key);
    const loaded = loadViewerKey("0x1234567890123456789012345678901234567890");
    expect(loaded).not.toBeNull();
    expect(loaded!.x).toBe(key.x);
    expect(loaded!.y).toBe(key.y);
    expect(loaded!.privateKey).toBe(key.privateKey);
  });

  test("loadViewerKey returns null for unknown address", () => {
    const result = loadViewerKey("0x0000000000000000000000000000000000000000");
    expect(result).toBeNull();
  });

  test("loadViewerKey handles null/undefined address", () => {
    expect(loadViewerKey(null)).toBeNull();
    expect(loadViewerKey(undefined)).toBeNull();
  });

  test("loadViewerKey handles missing window", () => {
    // @ts-expect-error — remove window mock
    delete globalThis.window;
    expect(loadViewerKey("0x1234567890123456789012345678901234567890")).toBeNull();
  });

  test("loadViewerKey handles corrupted storage entry", () => {
    const address = "0x1234567890123456789012345678901234567890";
    mockStorage[`ai-poker:viewer-key:${address.toLowerCase()}`] = "not-json";
    expect(loadViewerKey(address)).toBeNull();
  });

  test("loadViewerKey handles incomplete stored object", () => {
    const address = "0x1234567890123456789012345678901234567890";
    mockStorage[`ai-poker:viewer-key:${address.toLowerCase()}`] = JSON.stringify({ privateKey: "0xabc" });
    expect(loadViewerKey(address)).toBeNull();
  });
});
