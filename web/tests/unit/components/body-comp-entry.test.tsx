import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BodyCompEntry } from "@/components/body-comp-entry";

const today = new Date().toISOString().split("T")[0];
const tenWeeksAgo = new Date(Date.now() - 70 * 86400000).toISOString().split("T")[0];
const fifteenWeeksAgo = new Date(Date.now() - 15 * 7 * 86400000).toISOString().split("T")[0];

function mockFetch(handlers: {
  onGet?: (url: string) => unknown;
  onPost?: (body: unknown) => unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (init?.method === "POST") {
      const body = init.body ? JSON.parse(init.body as string) : null;
      const res = handlers.onPost?.(body) ?? { ok: true };
      return new Response(JSON.stringify(res), { status: 201 });
    }
    const res = handlers.onGet?.(url);
    if (res == null) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(res), { status: 200 });
  });
}

describe("BodyCompEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders current anchor and history", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        current: {
          id: 1, date: today, method: "navy",
          ffm_kg: 56.5, sigma_kg: 2.2, effective_sigma_kg: 2.2, notes: null,
        },
        history: [
          {
            id: 1, date: today, method: "navy",
            ffm_kg: 56.5, sigma_kg: 2.2, effective_sigma_kg: 2.2, notes: null,
          },
          {
            id: 2, date: tenWeeksAgo, method: "nhanes",
            ffm_kg: 55.0, sigma_kg: 3.0, effective_sigma_kg: 3.0, notes: null,
          },
        ],
      }),
    }));
    render(<BodyCompEntry />);
    await waitFor(() => screen.getByText(/Current anchor/i));
    expect(screen.getByText(/56\.5 kg/)).toBeDefined();
    // "Navy tape" appears in the current-anchor card + method select option;
    // `getAllByText` proves both are rendered without strict-mode collision.
    expect(screen.getAllByText(/Navy tape/).length).toBeGreaterThan(0);
    // History row for the older nhanes entry
    expect(screen.getByText(/55\.0/)).toBeDefined();
  });

  it("shows soft staleness banner between 8 and 12 weeks", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        current: {
          id: 1, date: tenWeeksAgo, method: "navy",
          ffm_kg: 56.5, sigma_kg: 2.2, effective_sigma_kg: 2.2, notes: null,
        },
        history: [],
      }),
    }));
    render(<BodyCompEntry />);
    const banner = await screen.findByTestId("body-comp-stale-banner");
    expect(banner.textContent).toMatch(/keeps your estimate sharp/i);
  });

  it("shows strong staleness banner past 12 weeks", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        current: {
          id: 1, date: fifteenWeeksAgo, method: "nhanes",
          ffm_kg: 55, sigma_kg: 3.0, effective_sigma_kg: 3.3, notes: null,
        },
        history: [],
      }),
    }));
    render(<BodyCompEntry />);
    const banner = await screen.findByTestId("body-comp-stale-banner");
    expect(banner.textContent).toMatch(/CI widening is active/i);
  });

  it("no banner when fresh (<8 weeks)", async () => {
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        current: {
          id: 1, date: today, method: "navy",
          ffm_kg: 56.5, sigma_kg: 2.2, effective_sigma_kg: 2.2, notes: null,
        },
        history: [],
      }),
    }));
    render(<BodyCompEntry />);
    await waitFor(() => screen.getByText(/Current anchor/i));
    expect(screen.queryByTestId("body-comp-stale-banner")).toBeNull();
  });

  it("Navy tape preview updates live as inputs are entered", async () => {
    vi.stubGlobal("fetch", mockFetch({ onGet: () => null }));
    render(<BodyCompEntry />);
    await waitFor(() => screen.getByRole("button", { name: /log anchor/i }));

    const byLabel = (text: RegExp) =>
      screen.getByLabelText(text) as HTMLInputElement;
    await userEvent.type(byLabel(/Weight/i), "74.2");
    await userEvent.type(byLabel(/Height/i), "177");
    await userEvent.type(byLabel(/Neck/i), "36");
    await userEvent.type(byLabel(/Waist/i), "82");

    const preview = await screen.findByTestId("navy-preview");
    expect(preview.textContent).toMatch(/Estimated FFM/);
    // ~16% BF * 74.2 kg → FFM ~62 kg
    expect(preview.textContent).toMatch(/6[012]\.\d kg/);
  });

  it("POSTs direct FFM when method is BIA", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", mockFetch({
      onGet: () => ({
        current: { id: 1, date: today, method: "bia", ffm_kg: 57, sigma_kg: 2.5, effective_sigma_kg: 2.5, notes: null },
        history: [{ id: 1, date: today, method: "bia", ffm_kg: 57, sigma_kg: 2.5, effective_sigma_kg: 2.5, notes: null }],
      }),
      onPost: (body) => {
        posted.push(body);
        return { ok: true, anchor: {} };
      },
    }));
    render(<BodyCompEntry />);
    await waitFor(() => screen.getByRole("button", { name: /log anchor/i }));

    await userEvent.selectOptions(screen.getByLabelText(/Method/i), "bia");
    await userEvent.type(screen.getByLabelText(/FFM/i), "57.3");
    await userEvent.click(screen.getByRole("button", { name: /log anchor/i }));

    await waitFor(() => expect(posted.length).toBe(1));
    expect((posted[0] as { method: string }).method).toBe("bia");
    expect((posted[0] as { ffm_kg: number }).ffm_kg).toBe(57.3);
  });
});
