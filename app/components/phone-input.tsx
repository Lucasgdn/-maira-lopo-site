"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { exceedsBrazilianPhoneLength, formatBrazilianPhone } from "../lib/phone.mjs";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function PhoneInput({ value, onChange, ...props }: Props) {
  const [notice, setNotice] = useState<{ message: string; blocking: boolean } | null>(null);

  function update(input: HTMLInputElement, raw: string, cursor: number, singleDigit = false) {
    if (exceedsBrazilianPhoneLength(raw)) {
      if (singleDigit && !notice?.blocking && raw.slice(0, cursor - 1) + raw.slice(cursor) === value) {
        input.value = value;
        input.setSelectionRange(cursor - 1, cursor - 1);
        input.setCustomValidity("");
        setNotice({ message: "Limite de 11 dígitos com DDD. O dígito adicional não foi inserido.", blocking: false });
        return;
      }
      const message = "Use até 11 dígitos com DDD. Corrija o número para continuar.";
      input.setCustomValidity(message);
      setNotice({ message, blocking: true });
      onChange(formatBrazilianPhone(raw));
      return;
    }
    input.setCustomValidity("");
    setNotice(null);
    const formatted = formatBrazilianPhone(raw);
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
    let position = formatted.startsWith("+") && raw.slice(0, cursor).includes("+") ? 1 : 0;
    let digitsSeen = 0;
    while (position < formatted.length && digitsSeen < digitsBeforeCursor) {
      if (/\d/.test(formatted[position])) digitsSeen++;
      position++;
    }
    onChange(formatted);
    requestAnimationFrame(() => {
      if (document.activeElement === input && input.value === formatted) {
        input.setSelectionRange(position, position);
      }
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const nativeEvent = event.nativeEvent;
    const singleDigit = nativeEvent instanceof InputEvent &&
      nativeEvent.inputType === "insertText" && /^\d$/.test(nativeEvent.data ?? "");
    update(input, input.value, input.selectionStart ?? input.value.length, singleDigit);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        (event.key !== "Backspace" && event.key !== "Delete")) return;
    const input = event.currentTarget;
    const start = input.selectionStart;
    if (start === null || start !== input.selectionEnd) return;
    const direction = event.key === "Backspace" ? -1 : 1;
    let index = direction === -1 ? start - 1 : start;
    if (index < 0 || index >= input.value.length || /\d/.test(input.value[index])) return;
    while (index >= 0 && index < input.value.length && !/\d/.test(input.value[index])) index += direction;
    if (index < 0 || index >= input.value.length) return;
    event.preventDefault();
    update(input, input.value.slice(0, index) + input.value.slice(index + 1), index);
  }

  return (
    <>
      <input {...props} aria-invalid={notice?.blocking ? true : props["aria-invalid"]} inputMode="tel" onChange={handleChange} onKeyDown={handleKeyDown} type="tel" value={value} />
      {notice && <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-red-700" role="alert">{notice.message}</span>}
    </>
  );
}
