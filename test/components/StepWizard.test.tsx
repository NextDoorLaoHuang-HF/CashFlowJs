import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepWizard, useStepWizard } from "@/components/StepWizard";

function TestChild() {
  const { currentStep, isFirst, isLast } = useStepWizard();
  return (
    <div data-testid="child">
      <span data-testid="step">{currentStep}</span>
      <span data-testid="first">{isFirst ? "yes" : "no"}</span>
      <span data-testid="last">{isLast ? "yes" : "no"}</span>
    </div>
  );
}

const steps = [
  { id: "s1", title: "Step 1" },
  { id: "s2", title: "Step 2" },
  { id: "s3", title: "Step 3" }
];

describe("StepWizard", () => {
  it("renders steps with correct states", () => {
    render(<StepWizard steps={steps} currentStep={1}><TestChild /></StepWizard>);
    expect(screen.getByText("Step 1").closest('[data-state]')).toHaveAttribute("data-state", "completed");
    expect(screen.getByText("Step 2").closest('[data-state]')).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Step 3").closest('[data-state]')).toHaveAttribute("data-state", "pending");
  });

  it("provides context values to children", () => {
    render(<StepWizard steps={steps} currentStep={0}><TestChild /></StepWizard>);
    expect(screen.getByTestId("step")).toHaveTextContent("0");
    expect(screen.getByTestId("first")).toHaveTextContent("yes");
    expect(screen.getByTestId("last")).toHaveTextContent("no");
  });

  it("calls onStepChange when next clicked", () => {
    const onChange = vi.fn();
    render(<StepWizard steps={steps} currentStep={0} onStepChange={onChange}><div /></StepWizard>);
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("calls onStepChange when prev clicked", () => {
    const onChange = vi.fn();
    render(<StepWizard steps={steps} currentStep={1} onStepChange={onChange}><div /></StepWizard>);
    fireEvent.click(screen.getByRole("button", { name: /上一步/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("disables prev on first step", () => {
    render(<StepWizard steps={steps} currentStep={0}><div /></StepWizard>);
    expect(screen.getByRole("button", { name: /上一步/i })).toBeDisabled();
  });

  it("disables next on last step", () => {
    render(<StepWizard steps={steps} currentStep={2}><div /></StepWizard>);
    expect(screen.getByRole("button", { name: /下一步/i })).toBeDisabled();
  });

  it("does not call onStepChange when prev on first step", () => {
    const onChange = vi.fn();
    render(<StepWizard steps={steps} currentStep={0} onStepChange={onChange}><div /></StepWizard>);
    fireEvent.click(screen.getByRole("button", { name: /上一步/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not call onStepChange when next on last step", () => {
    const onChange = vi.fn();
    render(<StepWizard steps={steps} currentStep={2} onStepChange={onChange}><div /></StepWizard>);
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports function children with controls", () => {
    const onChange = vi.fn();
    render(
      <StepWizard steps={steps} currentStep={1} onStepChange={onChange}>
        {(controls) => (
          <button onClick={controls.onNext}>Custom Next</button>
        )}
      </StepWizard>
    );
    fireEvent.click(screen.getByRole("button", { name: "Custom Next" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("clamps step to valid range", () => {
    render(<StepWizard steps={steps} currentStep={99}><TestChild /></StepWizard>);
    expect(screen.getByTestId("step")).toHaveTextContent("2");
    expect(screen.getByTestId("last")).toHaveTextContent("yes");
  });

  it("throws when useStepWizard used outside provider", () => {
    function BadChild() {
      useStepWizard();
      return null;
    }
    expect(() => render(<BadChild />)).toThrow(/必须在 StepWizard 内使用/);
  });
});
