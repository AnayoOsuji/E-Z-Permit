// Field rules for the dashboard's permit wizard. Free of React imports so it
// can be unit tested directly.
import { STATES } from "./places.ts";

export type WizardValues = { city: string; state: string; businessType: string };
export type FieldErrors = Partial<Record<keyof WizardValues, string>>;

export const WIZARD_STEPS = ["Location", "Business", "Review"] as const;
export const LAST_STEP = WIZARD_STEPS.length - 1;

export const BUSINESS_EXAMPLES = ["Food Truck", "Home Bakery", "Coffee Cart", "Hair Salon", "Retail Shop"];

export const STATE_OPTIONS = Object.entries(STATES).map(([code, name]) => ({ code, name }));

const CITY_PATTERN = /^\p{L}[\p{L}\s.'’-]*$/u;

/** Errors for the fields shown on one step (0 = location, 1 = business). The review step has no fields of its own. */
export function validateStep(step: number, values: WizardValues): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    const city = values.city.trim();
    if (!city) errors.city = "Enter the city you'll operate in.";
    else if (city.length < 2) errors.city = "That city name is too short.";
    else if (city.length > 80 || !CITY_PATTERN.test(city)) errors.city = "Use only letters, spaces, periods, apostrophes and hyphens.";
    if (!values.state) errors.state = "Choose a state.";
    else if (!STATES[values.state]) errors.state = "Choose a state from the list.";
  }
  if (step === 1) {
    const type = values.businessType.trim();
    if (!type) errors.businessType = "Tell us what kind of business you're starting.";
    else if (type.length < 3) errors.businessType = "Add a little more detail, like “Food Truck”.";
    else if (type.length > 100) errors.businessType = "Keep it under 100 characters.";
  }
  return errors;
}

/** The first step that has a problem, with its errors, or null when every field is valid. */
export function firstInvalidStep(values: WizardValues): { step: number; errors: FieldErrors } | null {
  for (const step of [0, 1]) {
    const errors = validateStep(step, values);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
