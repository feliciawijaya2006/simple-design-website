import { describe, it, expect } from "vitest";
import { canSkip, toggleSkip, markDelivered, isLowQuota, type Subscription } from "./catering";

const base: Subscription = { id: "x", name: "A", phone: "08", address: "", area: "", notes: "", pkg: "5hari", total: 5, remaining: 5, price: 0, status: "aktif", paid: true, start: "2026-01-01", skips: [], delivered: [], createdAt: "" };

describe("aturan katering", () => {
  it("skip boleh sebelum jam 20:00 H-1", () => expect(canSkip("2026-11-10", new Date(2026, 10, 9, 19, 59))).toBe(true));
  it("skip ditolak setelah jam 20:00 H-1", () => expect(canSkip("2026-11-10", new Date(2026, 10, 9, 20, 0))).toBe(false));
  it("skip tidak memotong kuota", () => expect(toggleSkip(base, "2026-11-10").remaining).toBe(5));
  it("pengiriman memotong 1 porsi", () => expect(markDelivered(base, "2026-11-10").remaining).toBe(4));
  it("peringatan tagihan saat sisa <= 2", () => {
    expect(isLowQuota({ ...base, remaining: 2 })).toBe(true);
    expect(isLowQuota({ ...base, remaining: 3 })).toBe(false);
  });
});
