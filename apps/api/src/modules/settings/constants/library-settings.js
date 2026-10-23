import joi from "joi";

/**
 * Library-wide policies. Amounts are integers in the currency's minor unit
 * (e.g. piastres/cents). Defaults are deliberately neutral — no fines are
 * charged until an administrator sets them — and every value is editable in
 * Dashboard → Settings. Per-member limits (loans, loan period, renewals,
 * reservations) belong to membership types, not here.
 */
const minorAmount = joi.number().integer().min(0);

const template = joi.object({
  subject: joi.string().max(200).required(),
  body: joi.string().max(5000).required(),
});

export const NOTIFICATION_TYPES = Object.freeze({
  dueSoon: "loan.due_soon",
  overdue: "loan.overdue",
  reservationReady: "reservation.ready",
  reservationExpired: "reservation.expired",
  membershipExpiring: "membership.expiring",
  paymentReceived: "payment.received",
  fineIssued: "fine.issued",
});

const N = NOTIFICATION_TYPES;

// {{placeholders}} are filled from the event's data; unknown ones are left empty.
const DEFAULT_TEMPLATES = {
  [N.dueSoon]: { subject: "“{{title}}” is due {{dueDate}}", body: "Hello {{memberName}},\n\n“{{title}}” (copy {{barcode}}) is due on {{dueDate}}. Renew it from your account if you need more time." },
  [N.overdue]: { subject: "“{{title}}” is overdue", body: "Hello {{memberName}},\n\n“{{title}}” (copy {{barcode}}) was due on {{dueDate}}. Please return it to any branch." },
  [N.reservationReady]: { subject: "Your reservation is ready: “{{title}}”", body: "Hello {{memberName}},\n\n“{{title}}” is waiting for you at {{branchName}} until {{expiresAt}}." },
  [N.reservationExpired]: { subject: "Your reservation for “{{title}}” expired", body: "Hello {{memberName}},\n\nYour reservation for “{{title}}” was not collected in time and has expired." },
  [N.membershipExpiring]: { subject: "Your membership expires {{expiresAt}}", body: "Hello {{memberName}},\n\nYour library membership ({{membershipType}}) expires on {{expiresAt}}. Visit any branch to renew it." },
  [N.paymentReceived]: { subject: "Payment received: {{amount}}", body: "Hello {{memberName}},\n\nWe received your payment of {{amount}} (receipt {{receiptNumber}}). Thank you." },
  [N.fineIssued]: { subject: "A fine was added to your account", body: "Hello {{memberName}},\n\nA {{fineType}} fine of {{amount}} was added to your account. {{reason}}" },
};

export const librarySettingsSchema = joi.object({
  currency: joi.string().uppercase().length(3).default("EGP"),
  circulation: joi
    .object({
      // Members whose outstanding balance exceeds this cannot borrow; null disables the check.
      blockBorrowingAboveBalance: minorAmount.allow(null).default(null),
      // Whether a loan may be renewed while other members are waiting for the title.
      allowRenewalWhenReserved: joi.boolean().default(false),
      // A copy returned at another branch is sent home (in transit) instead of shelved there.
      returnToHomeBranch: joi.boolean().default(true),
    })
    .default(),
  reservations: joi
    .object({
      // Days a ready reservation is held for pickup before it expires.
      holdPickupDays: joi.number().integer().min(1).max(60).default(3),
      // Whether members may pick up at a branch other than the copy's branch.
      allowCrossBranchPickup: joi.boolean().default(true),
    })
    .default(),
  fines: joi
    .object({
      overduePerDay: minorAmount.default(0),
      // Days after the due date before overdue fines start.
      graceDays: joi.number().integer().min(0).default(0),
      // Cap on the overdue fine for one loan; null: no cap.
      maxOverduePerLoan: minorAmount.allow(null).default(null),
      // Charged when a copy is declared lost; null charges the copy's recorded cost (0 if unknown).
      lostItemFee: minorAmount.allow(null).default(null),
      damagedItemFee: minorAmount.default(0),
    })
    .default(),
  notifications: joi
    .object({
      emailEnabled: joi.boolean().default(true),
      dueSoonDays: joi.number().integer().min(1).max(30).default(2),
      membershipExpiryDays: joi.number().integer().min(1).max(90).default(14),
      templates: joi
        .object(Object.fromEntries(Object.values(N).map((type) => [type, template.default(DEFAULT_TEMPLATES[type])])))
        .default(),
    })
    .default(),
  rooms: joi
    .object({
      maxBookingHours: joi.number().integer().min(1).max(24).default(4),
      maxAdvanceDays: joi.number().integer().min(1).max(365).default(30),
      // Members cannot cancel later than this many hours before a booking starts.
      cancellationCutoffHours: joi.number().integer().min(0).max(168).default(1),
    })
    .default(),
});

/** Fills in every default; `value` may be partial or empty. */
export function withDefaults(value = {}) {
  const { value: settings, error } = librarySettingsSchema.validate(value, { stripUnknown: true });
  if (error) throw error;
  return settings;
}
