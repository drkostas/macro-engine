import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HydrationCard } from "@/components/hydration-card";
import { HyponatremiaBanner } from "@/components/hyponatremia-banner";

const BASE_STATE = {
  logs: [
    { ts: "2026-04-22T08:00:00Z", volume_ml: 500, ethanol_g: 0, caffeine_mg: 0 },
  ],
  effectiveMl: 500,
  sodiumMg: 0,
  targets: {
    waterBeverageMl: 2078,
    waterTotalMl: 2597,
    sodiumMg: 1500,
  },
};

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
    const res = handlers.onGet?.() ?? BASE_STATE;
    return new Response(JSON.stringify(res), { status: 200 });
  });
}

describe("HydrationCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders ring with current/target values", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    render(<HydrationCard />);
    await waitFor(() => screen.getByTestId("hydration-card"));
    expect(screen.getByText(/500 \/ 2078/)).toBeDefined();
    expect(screen.getByText(/Na 0 \/ 1500/)).toBeDefined();
  });

  it("expands quick-log form on + Log click", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    render(<HydrationCard />);
    await waitFor(() => screen.getByTestId("hydration-toggle"));
    await userEvent.click(screen.getByTestId("hydration-toggle"));
    expect(screen.getByLabelText(/Volume/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Water/i })).toBeDefined();
  });

  it("POSTs drink on Log drink click", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => BASE_STATE,
      onPost: (body) => { posted.push(body); return { ok: true, effective_ml: 500 }; },
    }));
    render(<HydrationCard />);
    await waitFor(() => screen.getByTestId("hydration-toggle"));
    await userEvent.click(screen.getByTestId("hydration-toggle"));
    await userEvent.click(screen.getByTestId("hydration-submit"));
    await waitFor(() => expect(posted.length).toBeGreaterThan(0));
    const first = posted[0] as { volume_ml: number };
    expect(first.volume_ml).toBeGreaterThan(0);
  });

  it("beverage toggle updates default volume", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    render(<HydrationCard />);
    await waitFor(() => screen.getByTestId("hydration-toggle"));
    await userEvent.click(screen.getByTestId("hydration-toggle"));
    // Initial water = 500 mL
    expect(screen.getByText(/500 mL/)).toBeDefined();
    // Click Coffee button → volume switches to 250
    await userEvent.click(screen.getByRole("button", { name: /Coffee/i }));
    await waitFor(() => expect(screen.getByText(/250 mL/)).toBeDefined());
  });
});

describe("HyponatremiaBanner", () => {
  it("hidden when inactive", () => {
    const { container } = render(<HyponatremiaBanner active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("visible when active", () => {
    render(<HyponatremiaBanner active={true} />);
    expect(screen.getByTestId("hyponatremia-banner")).toBeDefined();
    expect(screen.getByText(/Hyponatremia risk/i)).toBeDefined();
  });
});
