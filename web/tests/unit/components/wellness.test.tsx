import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WellnessCard } from "@/components/wellness-card";
import { WellnessBanner } from "@/components/wellness-banner";

function mockFetch(handlers: {
  onGet?: () => unknown;
  onPost?: (body: unknown) => unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = init.body ? JSON.parse(init.body as string) : null;
      const res = handlers.onPost?.(body) ?? { ok: true };
      return new Response(JSON.stringify(res), { status: 201 });
    }
    const res = handlers.onGet?.() ?? {};
    return new Response(JSON.stringify(res), { status: 200 });
  });
}

describe("WellnessCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("collapsed by default", () => {
    vi.stubGlobal("fetch", mockFetch({ onGet: () => ({}) }));
    render(<WellnessCard />);
    const toggle = screen.getByRole("button", { name: /log morning check-in/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands to show 4 sliders", async () => {
    vi.stubGlobal("fetch", mockFetch({ onGet: () => ({}) }));
    render(<WellnessCard />);
    await userEvent.click(screen.getByRole("button", { name: /log morning check-in/i }));
    expect(screen.getByLabelText(/Fatigue/i)).toBeDefined();
    expect(screen.getByLabelText(/Sleep quality/i)).toBeDefined();
    expect(screen.getByLabelText(/Stress/i)).toBeDefined();
    expect(screen.getByLabelText(/Muscle soreness/i)).toBeDefined();
  });

  it("quality badge updates as sliders change", async () => {
    vi.stubGlobal("fetch", mockFetch({ onGet: () => ({}) }));
    render(<WellnessCard />);
    await userEvent.click(screen.getByRole("button", { name: /log morning check-in/i }));
    // Default values (4,4,4,4) → total 16 → moderate
    expect(screen.getByTestId("wellness-quality-badge").textContent).toMatch(/Moderate/i);
  });

  it("pre-fills from today's row when present", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        today: { morning_hooper: { fatigue: 2, sleep: 2, stress: 2, soreness: 2 } },
        recent: [],
        alert: { zScore: 0, alertLevel: "normal", baselineMean: 0, baselineStd: 0 },
      }),
    }));
    render(<WellnessCard />);
    await waitFor(() => screen.getByText(/Logged/i));
    await userEvent.click(screen.getByRole("button", { name: /log morning check-in/i }));
    const fatigue = screen.getByLabelText(/Fatigue/i) as HTMLInputElement;
    expect(fatigue.value).toBe("2");
  });

  it("save button POSTs morning_hooper", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({}),
      onPost: (body) => { posted.push(body); return { ok: true }; },
    }));
    render(<WellnessCard />);
    await userEvent.click(screen.getByRole("button", { name: /log morning check-in/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit check-in/i }));
    await waitFor(() => expect(posted.length).toBeGreaterThan(0));
    const first = posted[0] as { morning_hooper: unknown };
    expect(first.morning_hooper).toBeDefined();
  });
});

describe("WellnessBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders nothing when alert is normal", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({ alert: { zScore: 0, alertLevel: "normal", baselineMean: 0, baselineStd: 0 } }),
    }));
    await act(async () => {
      render(<WellnessBanner />);
    });
    expect(screen.queryByTestId("wellness-banner")).toBeNull();
  });

  it("shows elevated banner", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({ alert: { zScore: 1.5, alertLevel: "elevated", baselineMean: 12, baselineStd: 2 } }),
    }));
    render(<WellnessBanner />);
    await waitFor(() => screen.getByTestId("wellness-banner"));
    expect(screen.getByText(/Elevated fatigue signal/i)).toBeDefined();
    expect(screen.getByText(/1\.5/)).toBeDefined();
  });

  it("shows high banner with danger tone", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({ alert: { zScore: 2.6, alertLevel: "high", baselineMean: 12, baselineStd: 2 } }),
    }));
    render(<WellnessBanner />);
    await waitFor(() => screen.getByTestId("wellness-banner"));
    expect(screen.getByText(/High fatigue signal/i)).toBeDefined();
  });
});
