export type SummarySchedule = {
  sendTime: string;
  day: "today" | "tomorrow";
  startTime: string;
  endTime: string;
  includeConfirmed?: boolean;
  includePending?: boolean;
  sendWhenEmpty?: boolean;
};

export type CustomerReminder = {
  amount: string;
  unit: "hours" | "days";
  mode?: "elapsed" | "calendar";
  sendTime?: string;
};

export type ReminderSettings = {
  recipientPhone: string;
  summaries: SummarySchedule[];
  customerReminders: CustomerReminder[];
  automation?: {
    timeZone: string;
    lateMinutes: string;
    newBookings: boolean;
    summaries: boolean;
    customers: boolean;
    statusNotices?: boolean;
    newText: string;
    summaryText: string;
    customerText: string;
  };
};

export type SavedReminderSettings = ReminderSettings & { revision: string };

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function isAutomation(value: unknown): value is NonNullable<ReminderSettings["automation"]> {
  return typeof value === "object" && value !== null &&
    "timeZone" in value && typeof value.timeZone === "string" &&
    "lateMinutes" in value && typeof value.lateMinutes === "string" &&
    "newBookings" in value && typeof value.newBookings === "boolean" &&
    "summaries" in value && typeof value.summaries === "boolean" &&
    "customers" in value && typeof value.customers === "boolean" &&
    (!("statusNotices" in value) || typeof value.statusNotices === "boolean") &&
    "newText" in value && typeof value.newText === "string" &&
    "summaryText" in value && typeof value.summaryText === "string" &&
    "customerText" in value && typeof value.customerText === "string";
}

export function normalizeRecipientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function validateReminderSettings(settings: ReminderSettings): string | null {
  const phone = normalizeRecipientPhone(settings.recipientPhone);
  const automation = settings.automation;
  if ((phone && !/^55\d{10,11}$/.test(phone)) ||
      ((settings.summaries.length > 0 || automation?.newBookings) && !phone)) {
    return "Informe um WhatsApp válido com DDD para receber os resumos.";
  }
  if (automation) {
    if (typeof automation.timeZone !== "string" ||
        typeof automation.lateMinutes !== "string" ||
        typeof automation.newBookings !== "boolean" ||
        typeof automation.summaries !== "boolean" ||
        typeof automation.customers !== "boolean" ||
        (automation.statusNotices !== undefined && typeof automation.statusNotices !== "boolean") ||
        typeof automation.newText !== "string" ||
        typeof automation.summaryText !== "string" ||
        typeof automation.customerText !== "string") {
      return "Confira as opções de envio automático.";
    }
    if (automation.newBookings || automation.summaries || automation.customers) {
      if (!["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco"].includes(automation.timeZone) ||
          !(automation.lateMinutes === "always" ||
            (/^\d+$/.test(automation.lateMinutes) && Number(automation.lateMinutes) <= 1440))) {
        return "Confira as opções de horário dos envios.";
      }
      if ((automation.summaries && settings.summaries.length === 0) ||
          (automation.customers && settings.customerReminders.length === 0)) {
        return "Adicione ao menos um horário para cada tipo de envio ativado.";
      }
      if ((automation.newBookings && !automation.newText.trim()) ||
          (automation.summaries && !automation.summaryText.trim()) ||
          (automation.customers && !automation.customerText.trim())) {
        return "Informe o texto de cada tipo de mensagem ativado.";
      }
    }
  }
  for (const summary of settings.summaries) {
    if (!timePattern.test(summary.sendTime) ||
        (summary.includeConfirmed !== false && (!timePattern.test(summary.startTime) ||
          !timePattern.test(summary.endTime) || summary.startTime > summary.endTime)) ||
        !["today", "tomorrow"].includes(summary.day) ||
        (summary.includeConfirmed !== undefined && typeof summary.includeConfirmed !== "boolean") ||
        (summary.includePending !== undefined && typeof summary.includePending !== "boolean") ||
        (summary.sendWhenEmpty !== undefined && typeof summary.sendWhenEmpty !== "boolean") ||
        (summary.includeConfirmed === false && !summary.includePending)) {
      return "Confira o horário de envio e o início e fim de cada período da agenda.";
    }
  }
  for (const reminder of settings.customerReminders) {
    if (!/^[1-9]\d*$/.test(reminder.amount) || !Number.isSafeInteger(Number(reminder.amount)) ||
        !["hours", "days"].includes(reminder.unit) ||
        (reminder.mode !== undefined && reminder.mode !== "elapsed" && reminder.mode !== "calendar") ||
        (reminder.mode === "calendar" &&
          (reminder.unit !== "days" || !timePattern.test(reminder.sendTime ?? "")))) {
      return "Confira a quantidade, a forma de cálculo e o horário dos lembretes das clientes.";
    }
  }
  return null;
}

export function isSavedReminderSettings(value: unknown): value is SavedReminderSettings {
  if (typeof value !== "object" || value === null ||
      !("revision" in value) || typeof value.revision !== "string" || !value.revision ||
      !("recipientPhone" in value) || typeof value.recipientPhone !== "string" ||
      !("summaries" in value) || !Array.isArray(value.summaries) ||
      !("customerReminders" in value) || !Array.isArray(value.customerReminders)) {
    return false;
  }
  const summaries = value.summaries.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "sendTime" in item && typeof item.sendTime === "string" &&
    "day" in item && (item.day === "today" || item.day === "tomorrow") &&
    "startTime" in item && typeof item.startTime === "string" &&
    "endTime" in item && typeof item.endTime === "string" &&
    (!("includeConfirmed" in item) || typeof item.includeConfirmed === "boolean") &&
    (!("includePending" in item) || typeof item.includePending === "boolean") &&
    (!("sendWhenEmpty" in item) || typeof item.sendWhenEmpty === "boolean"),
  );
  const reminders = value.customerReminders.every((item: unknown) =>
    typeof item === "object" && item !== null &&
    "amount" in item && typeof item.amount === "string" &&
    "unit" in item && (item.unit === "hours" || item.unit === "days") &&
    (!("mode" in item) || item.mode === "elapsed" || item.mode === "calendar") &&
    (!("sendTime" in item) || typeof item.sendTime === "string"),
  );
  const automation = "automation" in value ? value.automation : undefined;
  if (automation !== undefined && !isAutomation(automation)) return false;
  if (!summaries || !reminders) return false;
  return validateReminderSettings({
    recipientPhone: value.recipientPhone,
    summaries: value.summaries,
    customerReminders: value.customerReminders,
    automation,
  }) === null;
}
