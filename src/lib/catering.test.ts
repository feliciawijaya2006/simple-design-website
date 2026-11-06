import { describe, it, expect } from "vitest";
import { canSkip, flexibleBookingError, isLowQuota, needsMeal, reservedPortions, type Subscription } from "./catering";

const base: Subscription = {
  id: "x", code: "RK-X", userId: "user-1", name: "A", phone: "08", address: "", area: "", notes: "",
  pkg: "5hari", total: 5, remaining: 5, price: 0, status: "aktif", paid: true,
  start: "2026-01-01", skips: [], delivered: [], bookings: [], createdAt: "",
};
const flexible: Subscription = { ...base, pkg: "fleksibel", total: 10, remaining: 10 };

describe("aturan katering", () => {
  it("perubahan boleh sebelum jam 20:00 H-1", () => expect(canSkip("2026-11-10", new Date(2026, 10, 9, 19, 59))).toBe(true));
  it("perubahan ditolak mulai jam 20:00 H-1", () => expect(canSkip("2026-11-10", new Date(2026, 10, 9, 20, 0))).toBe(false));
  it("pemilik kuota fleksibel dapat memilih tanggal dan 2 porsi", () => {
    expect(flexibleBookingError(flexible, "2026-11-10", 2, new Date(2026, 10, 9, 19, 59))).toBeNull();
  });
  it("jumlah pesanan fleksibel tidak boleh melebihi 10 porsi tersedia", () => {
    expect(flexibleBookingError(flexible, "2026-11-10", 11, new Date(2026, 10, 9, 19, 59))).toBe("Sisa kuota hanya 10 porsi.");
  });
  it("paket fleksibel tidak diantar otomatis tanpa jadwal", () => expect(needsMeal(flexible, "2026-11-10")).toBe(false));
  it("kuota terjadwal dihitung dari seluruh jadwal aktif", () => {
    expect(reservedPortions({ ...flexible, bookings: [
      { id: "b1", date: "2026-11-10", portions: 2, status: "terjadwal" },
      { id: "b2", date: "2026-11-11", portions: 3, status: "terjadwal" },
      { id: "b3", date: "2026-11-12", portions: 4, status: "batal" },
    ] })).toBe(5);
  });
  it("peringatan tagihan muncul saat sisa <= 2", () => {
    expect(isLowQuota({ ...base, remaining: 2 })).toBe(true);
    expect(isLowQuota({ ...base, remaining: 3 })).toBe(false);
  });
});
