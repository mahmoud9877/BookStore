import mongoose, { Schema, Types, model } from "mongoose";

export const DIGITAL_ACCESS = Object.freeze({
  public: "public", // anyone (e.g. public-domain works)
  members: "members", // members in good standing whose type allows digital access
  membershipTypes: "membership_types", // only the listed membership types
  staff: "staff", // internal documents
});

export const LICENSE_TYPES = Object.freeze(["public_domain", "open_license", "licensed", "owned"]);

/**
 * A digital publication. The file is in private storage and only ever streamed
 * through an access-checked endpoint; there is no public URL.
 */
const digitalPublicationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    book: { type: Types.ObjectId, ref: "Book", default: null }, // its catalogue record, if any
    description: String,
    authors: String,
    format: { type: String, enum: ["pdf", "epub", "audio", "video"], required: true },
    file: {
      key: { type: String, required: true },
      mimeType: String,
      size: Number,
      originalName: String,
    },
    access: { type: String, enum: Object.values(DIGITAL_ACCESS), default: DIGITAL_ACCESS.members },
    membershipTypes: [{ type: Types.ObjectId, ref: "MembershipType" }],
    allowDownload: { type: Boolean, default: false }, // false: viewed inline only
    license: {
      type: { type: String, enum: LICENSE_TYPES, required: true },
      holder: String,
      expiresAt: Date, // after this the publication is no longer served
      terms: String,
    },
    isPublished: { type: Boolean, default: false },
    uploadedBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

digitalPublicationSchema.index({ isPublished: 1, access: 1 });
digitalPublicationSchema.index({ title: "text", authors: "text", description: "text" }, { name: "digital_text" });

export const digitalPublicationModel = mongoose.models.DigitalPublication || model("DigitalPublication", digitalPublicationSchema);

/** Who opened what (licence reporting). */
const digitalAccessLogSchema = new Schema(
  {
    publication: { type: Types.ObjectId, ref: "DigitalPublication", required: true },
    user: { type: Types.ObjectId, ref: "User", default: null },
    member: { type: Types.ObjectId, ref: "Member", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
digitalAccessLogSchema.index({ publication: 1, createdAt: -1 });

export const digitalAccessLogModel = mongoose.models.DigitalAccessLog || model("DigitalAccessLog", digitalAccessLogSchema);
