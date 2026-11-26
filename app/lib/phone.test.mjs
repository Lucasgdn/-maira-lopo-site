import assert from "node:assert/strict";
import test from "node:test";
import { exceedsBrazilianPhoneLength, formatBrazilianPhone, normalizeBrazilianPhone } from "./phone.mjs";

test("formats Brazilian mobile and landline numbers while typing", () => {
  assert.equal(formatBrazilianPhone(""), "");
  assert.equal(formatBrazilianPhone("1"), "(1");
  assert.equal(formatBrazilianPhone("1198765"), "(11) 9876-5");
  assert.equal(formatBrazilianPhone("1133334444"), "(11) 3333-4444");
  assert.equal(formatBrazilianPhone("11987654321"), "(11) 98765-4321");
});

test("accepts country code and preserves area code 55", () => {
  assert.equal(formatBrazilianPhone("+5511987654321"), "+55 (11) 98765-4321");
  assert.equal(formatBrazilianPhone("5511987654321"), "+55 (11) 98765-4321");
  assert.equal(formatBrazilianPhone("55 11 98765-4321"), "+55 (11) 98765-4321");
  assert.equal(formatBrazilianPhone("551198765432"), "+55 (11) 9876-5432");
  assert.equal(formatBrazilianPhone("55987654321"), "(55) 98765-4321");
  assert.equal(normalizeBrazilianPhone("(55) 98765-4321"), "5555987654321");
  assert.equal(formatBrazilianPhone("(55) 98765-43210"), "(55) 98765-43210");
  assert.equal(normalizeBrazilianPhone("(55) 98765-43210"), "55559876543210");
  assert.equal(normalizeBrazilianPhone("+55 (11) 98765-4321"), "5511987654321");
});

test("does not hide extra digits or reinterpret an explicit foreign code", () => {
  assert.equal(formatBrazilianPhone("1198765432199"), "(11) 98765-432199");
  assert.equal(normalizeBrazilianPhone(formatBrazilianPhone("1198765432199")), "551198765432199");
  assert.equal(normalizeBrazilianPhone(formatBrazilianPhone("+14155551234")), "14155551234");
});

test("detects excess digits with and without the Brazilian country code", () => {
  assert.equal(exceedsBrazilianPhoneLength("(19) 99724-3537"), false);
  assert.equal(exceedsBrazilianPhoneLength("(19) 99724-35377"), true);
  assert.equal(exceedsBrazilianPhoneLength("(55) 98765-43210"), true);
  assert.equal(exceedsBrazilianPhoneLength("+55 (19) 99724-3537"), false);
  assert.equal(exceedsBrazilianPhoneLength("5519997243537"), false);
  assert.equal(exceedsBrazilianPhoneLength("+55 (19) 99724-35377"), true);
  assert.equal(exceedsBrazilianPhoneLength("55199972435377"), true);
});
