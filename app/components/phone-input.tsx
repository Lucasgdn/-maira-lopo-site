"use client";

import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent } from "react";
import { formatBrazilianPhone } from "../lib/phone.mjs";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function PhoneInput({ value, onChange, ...props }: Props) {
  function update(input: HTMLInputElement, raw: string, cursor: number) {
    const formatted = formatBrazilianPhone(raw);
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
    let position = 0;
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
    update(input, input.value, input.selectionStart ?? input.value.length);
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

  return <input {...props} inputMode="tel" onChange={handleChange} onKeyDown={handleKeyDown} type="tel" value={value} />;
}
