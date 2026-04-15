import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariationStrip } from "@/components/variation-strip";
import { createVariation } from "@/lib/variation-state";

function seed() {
  const v1 = createVariation();
  v1.name = "Chicken bowl"; v1.isNameManual = true;
  const v2 = createVariation();
  v2.name = "Salmon bowl"; v2.isNameManual = true;
  return { v1, v2 };
}

describe("VariationStrip", () => {
  it("renders every variation with name + kcal + delta chip", () => {
    const { v1, v2 } = seed();
    const macros = new Map([[v1.id, { calories: 470 }], [v2.id, { calories: 520 }]]);
    render(
      <VariationStrip
        variations={[v1, v2]}
        activeId={v1.id}
        macros={macros as never}
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        onSwitch={vi.fn()}
        onLog={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText("Chicken bowl")).toBeInTheDocument();
    expect(screen.getByText("Salmon bowl")).toBeInTheDocument();
    expect(screen.getByText("470 kcal")).toBeInTheDocument();
    expect(screen.getByText("520 kcal")).toBeInTheDocument();
  });

  it("calls onSwitch when a non-active row is tapped", () => {
    const { v1, v2 } = seed();
    const onSwitch = vi.fn();
    const macros = new Map([[v1.id, { calories: 470 }], [v2.id, { calories: 520 }]]);
    render(
      <VariationStrip
        variations={[v1, v2]}
        activeId={v1.id}
        macros={macros as never}
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        onSwitch={onSwitch}
        onLog={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Salmon bowl"));
    expect(onSwitch).toHaveBeenCalledWith(v2.id);
  });

  it("calls onLog(variationId) when per-row Log is clicked", () => {
    const { v1, v2 } = seed();
    const onLog = vi.fn();
    const macros = new Map([[v1.id, { calories: 470 }], [v2.id, { calories: 520 }]]);
    render(
      <VariationStrip
        variations={[v1, v2]}
        activeId={v1.id}
        macros={macros as never}
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        onSwitch={vi.fn()}
        onLog={onLog}
        onAdd={vi.fn()}
      />,
    );
    const logButtons = screen.getAllByRole("button", { name: /^Log V/ });
    fireEvent.click(logButtons[1]);
    expect(onLog).toHaveBeenCalledWith(v2.id);
  });

  it("renders a + New variation button that calls onAdd", () => {
    const { v1 } = seed();
    const onAdd = vi.fn();
    const macros = new Map([[v1.id, { calories: 0 }]]);
    render(
      <VariationStrip
        variations={[v1]}
        activeId={v1.id}
        macros={macros as never}
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        onSwitch={vi.fn()}
        onLog={vi.fn()}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /new variation/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
