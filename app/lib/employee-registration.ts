export const CPF_DIGIT_COUNT = 11;
export const REGISTRATION_DIGIT_COUNT = 5;

export function cpfDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, CPF_DIGIT_COUNT);
}

export function registrationFromCpf(value: unknown) {
  const digits = cpfDigits(value);
  return digits.length >= REGISTRATION_DIGIT_COUNT
    ? digits.slice(0, REGISTRATION_DIGIT_COUNT)
    : "";
}

export function hasCompleteCpf(value: unknown) {
  return cpfDigits(value).length === CPF_DIGIT_COUNT;
}

export function formatCpf(value: unknown) {
  const digits = cpfDigits(value);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
