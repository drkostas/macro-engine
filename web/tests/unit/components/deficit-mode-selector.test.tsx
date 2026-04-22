import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeficitModeSelector } from "@/components/deficit-mode-selector";

const BASE_GET = {
  current: "standard",
  config: {
    tierAllowed: ["T1", "T2", "T3", "T4"],
    bfHardFloorPct: null,
    requiresReverseBridgeFrom: [],
    maxDurationDays: null,
  },
  availableTransitions: {
    aggressive: { allowed: false, reason: "mode_not_available", requiresBridge: null },
    reverse: { allowed: true, reason: null, requiresBridge: null },
    maintenance: { allowed: true, reason: null, requiresBridge: null },
    bulk: {
      allowed: false,
      reason: "requires_reverse_bridge",
      requiresBridge: "reverse",
    },
    injured: { allowed: true, reason: null, requiresBridge: null },
  },
};

describe("DeficitModeSelector", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input.includes("/api/nutrition/mode")) {
        return new Response(JSON.stringify(BASE_GET), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the current mode with a 'current' badge", async () => {
    render(<DeficitModeSelector />);
    await waitFor(() => {
      expect(screen.getByText(/Standard cut/i)).toBeDefined();
    });
    const currentRow = screen.getByTestId("deficit-mode-row-standard");
    expect(within(currentRow).getByText(/current/i)).toBeDefined();
  });

  it("shows an inline reason for gate-blocked modes", async () => {
    render(<DeficitModeSelector />);
    await waitFor(() => {
      // Tier-blocked aggressive surfaces the tier message.
      expect(screen.getByText(/not available at your tier/i)).toBeDefined();
    });
  });

  it("shows the bridge message for cut→bulk", async () => {
    render(<DeficitModeSelector />);
    await waitFor(() => {
      expect(screen.getByText(/reverse diet bridge/i)).toBeDefined();
    });
  });

  it("disables Switch button on blocked modes", async () => {
    render(<DeficitModeSelector />);
    await waitFor(() => screen.getByText(/Aggressive cut/i));
    const aggressiveRow = screen.getByTestId("deficit-mode-row-aggressive");
    const button = within(aggressiveRow).getByRole("button", { name: /blocked/i });
    expect(button).toHaveProperty("disabled", true);
  });

  it("POSTs on Switch click and refetches", async () => {
    // First call (GET) returns BASE_GET. POST returns ok. Second GET (refresh)
    // returns a response where current = maintenance.
    const postedModes: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const parsed = JSON.parse(init.body as string);
        postedModes.push(parsed.mode);
        return new Response(JSON.stringify({ ok: true, current: parsed.mode }), { status: 200 });
      }
      const body = postedModes.length
        ? { ...BASE_GET, current: postedModes[postedModes.length - 1] }
        : BASE_GET;
      return new Response(JSON.stringify(body), { status: 200 });
    });

    render(<DeficitModeSelector />);
    await waitFor(() => screen.getByTestId("deficit-mode-row-maintenance"));

    const maintRow = screen.getByTestId("deficit-mode-row-maintenance");
    await userEvent.click(within(maintRow).getByRole("button", { name: /switch/i }));

    await waitFor(() => expect(postedModes).toContain("maintenance"));
  });

  it("opens info modal on info button click", async () => {
    render(<DeficitModeSelector />);
    await waitFor(() => screen.getByText(/Aggressive cut/i));

    const aggressiveRow = screen.getByTestId("deficit-mode-row-aggressive");
    await userEvent.click(within(aggressiveRow).getByRole("button", { name: /about aggressive cut/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Research basis/i)).toBeDefined();
    expect(within(dialog).getByText(/Longland 2016/i)).toBeDefined();
  });
});
