/** @param {string} phone */
export function normalizeBrazilianPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (phone.trimStart().startsWith("+")) return digits;
  return digits && (digits.length <= 11 || phone.includes("(")) ? `55${digits}` : digits;
}

/** @param {string} phone */
export function formatBrazilianPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  const explicitCountry = phone.trimStart().startsWith("+");
  if (explicitCountry && !digits.startsWith("55")) return `+${digits}`;

  const hasCountry = explicitCountry || (!phone.includes("(") && /^55\d{10,11}$/.test(digits));
  const national = hasCountry ? digits.slice(2) : digits;
  const prefix = hasCountry ? `+55${national ? " " : ""}` : "";
  if (!national) return prefix;
  if (national.length <= 2) return `${prefix}(${national}`;

  const area = national.slice(0, 2);
  const number = national.slice(2);
  const firstPartLength = number.length > 8 ? 5 : 4;
  const firstPart = number.slice(0, firstPartLength);
  const rest = number.slice(firstPartLength);
  return `${prefix}(${area}) ${firstPart}${rest ? `-${rest}` : ""}`;
}

/** @param {string} phone */
export function exceedsBrazilianPhoneLength(phone) {
  const formatted = formatBrazilianPhone(phone);
  const digits = formatted.replace(/\D/g, "");
  return digits.length > (formatted.startsWith("+55") ? 13 : 11);
}
