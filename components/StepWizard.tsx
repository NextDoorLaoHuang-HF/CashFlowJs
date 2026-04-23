"use client";

import { clsx } from "clsx";
import { createContext, useContext, type ReactNode } from "react";

type StepDefinition = {
  id: string;
  title: string;
};

type StepWizardControls = {
  currentStep: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
};

type StepWizardProps = {
  steps: StepDefinition[];
  currentStep: number;
  children: ReactNode | ((controls: StepWizardControls) => ReactNode);
  onStepChange?: (step: number) => void;
  className?: string;
  nextLabel?: string;
  prevLabel?: string;
};

const StepWizardContext = createContext<StepWizardControls | null>(null);

export function useStepWizard() {
  const context = useContext(StepWizardContext);

  if (!context) {
    throw new Error("useStepWizard 必须在 StepWizard 内使用");
  }

  return context;
}

export function StepWizard({
  steps,
  currentStep,
  children,
  onStepChange,
  className,
  nextLabel = "下一步",
  prevLabel = "上一步"
}: StepWizardProps) {
  const totalSteps = steps.length;
  const safeStep = Math.min(Math.max(currentStep, 0), Math.max(totalSteps - 1, 0));

  const controls: StepWizardControls = {
    currentStep: safeStep,
    totalSteps,
    isFirst: safeStep === 0,
    isLast: safeStep === totalSteps - 1,
    onNext: () => {
      if (safeStep < totalSteps - 1) {
        onStepChange?.(safeStep + 1);
      }
    },
    onPrev: () => {
      if (safeStep > 0) {
        onStepChange?.(safeStep - 1);
      }
    }
  };

  return (
    <StepWizardContext.Provider value={controls}>
      <div className={clsx("wizard", className)}>
        <div className="wizard-steps" aria-label="步骤进度">
          {steps.map((step, index) => {
            const state = index < safeStep ? "completed" : index === safeStep ? "active" : "pending";

            return (
              <div key={step.id} className="wizard-step" data-state={state} aria-current={index === safeStep ? "step" : undefined}>
                <span className="text-xs text-muted">步骤 {index + 1}</span>
                <strong className="text-sm">{step.title}</strong>
              </div>
            );
          })}
        </div>

        <div className="wizard-content">{typeof children === "function" ? children(controls) : children}</div>

        <div className="wizard-actions">
          <button type="button" className="btn btn-secondary" onClick={controls.onPrev} disabled={controls.isFirst}>
            {prevLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={controls.onNext} disabled={controls.isLast}>
            {nextLabel}
          </button>
        </div>
      </div>
    </StepWizardContext.Provider>
  );
}
