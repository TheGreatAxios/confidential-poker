import { describe, expect, test } from "bun:test";
import { isContractDeployed } from "./contracts";

describe("isContractDeployed", () => {
  test("valid deployed address", () => {
    expect(isContractDeployed("0x1234567890123456789012345678901234567890")).toBe(true);
  });

  test("zero address is not deployed", () => {
    expect(isContractDeployed("0x0000000000000000000000000000000000000000")).toBe(false);
  });

  test("wrong length is not deployed", () => {
    expect(isContractDeployed("0x1234")).toBe(false);
  });

  test("empty string is not deployed", () => {
    expect(isContractDeployed("")).toBe(false);
  });
});
