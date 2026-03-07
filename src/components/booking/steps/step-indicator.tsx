"use client";

import { ChevronRight } from "lucide-react";
import type { BookingStep } from "@/hooks/use-booking-form";

interface StepIndicatorProps {
  currentStep: BookingStep;
  canProceedToStay: boolean;
  canProceedToSummary: boolean;
  onStepChange: (step: BookingStep) => void;
}

interface StepButtonProps {
  step: BookingStep;
  label: string;
  number: number;
  isActive: boolean;
  isEnabled: boolean;
  onClick: () => void;
}

function StepButton({ label, number, isActive, isEnabled, onClick }: StepButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isEnabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isActive
          ? "bg-navy text-cream"
          : isEnabled
            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
            : "bg-gray-50 text-gray-400 cursor-not-allowed"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
        {number}
      </span>
      {label}
    </button>
  );
}

export function StepIndicator({
  currentStep,
  canProceedToStay,
  canProceedToSummary,
  onStepChange,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <StepButton
        step="guest"
        label="Guest"
        number={1}
        isActive={currentStep === "guest"}
        isEnabled={true}
        onClick={() => onStepChange("guest")}
      />
      <ChevronRight className="h-4 w-4 text-gray-400" />
      <StepButton
        step="stay"
        label="Stay"
        number={2}
        isActive={currentStep === "stay"}
        isEnabled={canProceedToStay}
        onClick={() => canProceedToStay && onStepChange("stay")}
      />
      <ChevronRight className="h-4 w-4 text-gray-400" />
      <StepButton
        step="summary"
        label="Summary"
        number={3}
        isActive={currentStep === "summary"}
        isEnabled={canProceedToStay && canProceedToSummary}
        onClick={() => canProceedToStay && canProceedToSummary && onStepChange("summary")}
      />
    </div>
  );
}
