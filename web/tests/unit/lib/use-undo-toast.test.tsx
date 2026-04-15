import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UndoToastProvider, useUndoToast } from "@/lib/use-undo-toast";

function Harness({ onUndo, label = "Item removed" }: { onUndo: () => Promise<void> | void; label?: string }) {
  const { show } = useUndoToast();
  return (
    <button onClick={() => show({ label, onUndo, timeoutMs: 5000 })}>
      Trigger
    </button>
  );
}

describe("useUndoToast", () => {
  it("throws if used outside the provider", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness onUndo={() => {}} />)).toThrow();
    err.mockRestore();
  });

  it("shows the toast with label after calling show()", async () => {
    const user = userEvent.setup();
    render(
      <UndoToastProvider>
        <Harness onUndo={() => {}} />
      </UndoToastProvider>,
    );
    await user.click(screen.getByText("Trigger"));
    expect(screen.getByRole("status", { name: "Undo action" })).toBeInTheDocument();
    expect(screen.getByText("Item removed")).toBeInTheDocument();
  });

  it("invokes onUndo when Undo is clicked and dismisses the toast", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn(async () => {});
    render(
      <UndoToastProvider>
        <Harness onUndo={onUndo} />
      </UndoToastProvider>,
    );
    await user.click(screen.getByText("Trigger"));
    await user.click(screen.getByText("Undo"));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByText("Item removed")).not.toBeInTheDocument();
  });

  it("dismiss button clears the toast without invoking onUndo", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <UndoToastProvider>
        <Harness onUndo={onUndo} />
      </UndoToastProvider>,
    );
    await user.click(screen.getByText("Trigger"));
    await user.click(screen.getByLabelText("Dismiss"));
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText("Item removed")).not.toBeInTheDocument();
  });

  it("auto-dismisses after timeoutMs (real timers)", async () => {
    // Use a short timeout to keep the test fast
    function FastHarness() {
      const { show } = useUndoToast();
      return (
        <button onClick={() => show({ label: "Auto dismiss", onUndo: () => {}, timeoutMs: 100 })}>
          Trigger
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <UndoToastProvider>
        <FastHarness />
      </UndoToastProvider>,
    );
    await user.click(screen.getByText("Trigger"));
    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();
  });
});
