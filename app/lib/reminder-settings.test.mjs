import assert from "node:assert/strict";
import test from "node:test";
import {
  isSavedReminderSettings,
  normalizeRecipientPhone,
  validateReminderSettings,
} from "./reminder-settings.ts";

const valid = {
  recipientPhone: "(19) 99999-9999",
  summaries: [
    { sendTime: "09:00", day: "today", startTime: "08:00", endTime: "12:00" },
    { sendTime: "20:00", day: "tomorrow", startTime: "08:00", endTime: "11:59" },
  ],
  customerReminders: [{ amount: "1", unit: "days" }, { amount: "1", unit: "hours" }],
};

test("accepts independent summary periods and customer reminder intervals", () => {
  assert.equal(validateReminderSettings(valid), null);
  assert.equal(normalizeRecipientPhone(valid.recipientPhone), "5519999999999");
  assert.equal(normalizeRecipientPhone("5519999999999"), "5519999999999");
  assert.equal(normalizeRecipientPhone("(55) 99999-9999"), "5555999999999");
  assert.equal(normalizeRecipientPhone("+55 (19) 99999-9999"), "5519999999999");
  assert.equal(validateReminderSettings({ recipientPhone: "", summaries: [], customerReminders: [] }), null);
});

test("rejects invalid recipient, periods, and reminder amounts", () => {
  assert.ok(validateReminderSettings({ ...valid, recipientPhone: "" }));
  assert.ok(validateReminderSettings({ ...valid, recipientPhone: "123" }));
  assert.ok(validateReminderSettings({ ...valid, recipientPhone: "+14155551234" }));
  assert.ok(validateReminderSettings({ ...valid, recipientPhone: "+" }));
  assert.ok(validateReminderSettings({ ...valid, summaries: [{ ...valid.summaries[0], startTime: "13:00" }] }));
  assert.ok(validateReminderSettings({ ...valid, summaries: [{ ...valid.summaries[0], sendTime: "25:00" }] }));
  for (const amount of ["", "0", "-1", "1.5", "9007199254740992"]) {
    assert.ok(validateReminderSettings({ ...valid, customerReminders: [{ amount, unit: "hours" }] }));
  }
  assert.equal(validateReminderSettings({ ...valid, customerReminders: [{ amount: "1", unit: "days", mode: "calendar", sendTime: "09:00" }] }), null);
  assert.ok(validateReminderSettings({ ...valid, customerReminders: [{ amount: "1", unit: "days", mode: "calendar", sendTime: "" }] }));
  assert.ok(validateReminderSettings({ ...valid, customerReminders: [{ amount: "1", unit: "hours", mode: "calendar", sendTime: "09:00" }] }));
});

test("does not accept corrupt stored configuration", () => {
  assert.equal(isSavedReminderSettings({ ...valid, revision: "revision" }), true);
  assert.equal(isSavedReminderSettings({ ...valid, revision: "" }), false);
  assert.equal(isSavedReminderSettings({ ...valid, revision: "revision", summaries: [null] }), false);
  assert.equal(isSavedReminderSettings({ ...valid, revision: "revision", customerReminders: [{ amount: "0", unit: "hours" }] }), false);
});
