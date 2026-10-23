import React, { useState } from "react";
import SimpleCrudSection from "../../authors/components/SimpleCrudSection.jsx";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import { humanize } from "../../../lib/format.js";
import { useActiveBranches, useLocations } from "../queries/branch.queries.js";
import { msg, t } from "../../../i18n/index.js";
import { isValidMobile } from "../../../lib/phone.js";

const BRANCH_FIELDS = [
  { name: "code", label: msg("Code"), required: true, hint: msg("Short and unique, e.g. MAIN. Used in barcodes.") },
  { name: "name", label: msg("Name"), required: true },
  { name: "address", label: msg("Address") },
  { name: "phone", label: msg("Mobile number"), type: "tel", validate: (value) => (isValidMobile(value) ? null : msg("Enter a valid mobile number.")) },
  { name: "email", label: msg("Email"), type: "email" },
  { name: "isActive", label: msg("Open (accepts pickups and returns)"), type: "checkbox" },
];

const BRANCH_COLUMNS = [
  { key: "code", header: msg("Code"), render: (branch) => <span className="scan-input fw-semibold">{branch.code}</span> },
  { key: "name", header: msg("Name") },
  { key: "address", header: msg("Address"), hideBelow: "md" },
  { key: "isActive", header: msg("Status"), render: (branch) => <StatusBadge status={branch.isActive ? "active" : "closed"} label={branch.isActive ? t("Open") : t("Closed")} /> },
];

/** Rooms and shelves of one branch. A shelf may sit in a room. */
function LocationsSection({ branch }) {
  const rooms = useLocations(branch).data.filter((location) => location.type === "room");
  const roomName = (id) => rooms.find((room) => room._id === id)?.code ?? "";
  return (
    <SimpleCrudSection
      key={branch}
      entity={msg("Location")}
      queryKey={["locations", "admin", branch]}
      url="/locations"
      filters={{ branch }}
      invalidate={[["locations"]]}
      searchPlaceholder={msg("Search rooms and shelves")}
      fields={[
        { name: "type", label: msg("Type"), type: "select", required: true, options: [{ value: "room", label: t("Room") }, { value: "shelf", label: t("Shelf") }] },
        { name: "code", label: msg("Code"), required: true, hint: msg("e.g. A or A-01") },
        { name: "name", label: msg("Name") },
        { name: "parent", label: msg("In room (shelves only)"), type: "select", options: rooms.map((room) => ({ value: room._id, label: `${room.code} ${room.name ?? ""}` })) },
      ]}
      columns={[
        { key: "code", header: msg("Code"), render: (location) => <span className="scan-input fw-semibold">{location.code}</span> },
        { key: "type", header: msg("Type"), render: (location) => humanize(location.type) },
        { key: "name", header: msg("Name"), hideBelow: "md" },
        { key: "parent", header: msg("Room"), hideBelow: "md", render: (location) => roomName(location.parent) },
      ]}
      toForm={(location) => ({ type: location.type ?? "shelf", code: location.code ?? "", name: location.name ?? "", parent: location.parent ?? "" })}
      fromForm={(values, existing) => ({
        ...(existing._id ? {} : { branch }),
        type: values.type,
        code: values.code,
        name: values.name,
        parent: values.type === "shelf" && values.parent ? values.parent : null,
      })}
      empty={{ icon: "bookshelf", title: t("No rooms or shelves yet"), message: t("Add a room, then the shelves in it.") }}
    />
  );
}

/** Staff page: branches, and the rooms and shelves inside each. */
export default function BranchesPage() {
  const branches = useActiveBranches().data;
  const [branch, setBranch] = useState("");
  const selected = branch || branches[0]?._id || "";

  return (
    <>
      <PageHeader title={t("Branches & shelves")} description={t("Each copy belongs to a branch and may sit on a shelf.")} />
      <SimpleCrudSection
        entity={msg("Branch")}
        queryKey={["branches", "admin"]}
        url="/branches"
        invalidate={[["branches"]]}
        searchPlaceholder={msg("Search branches")}
        fields={BRANCH_FIELDS}
        columns={BRANCH_COLUMNS}
        toForm={(record) => ({ code: record.code ?? "", name: record.name ?? "", address: record.address ?? "", phone: record.phone ?? "", email: record.email ?? "", isActive: record.isActive ?? true })}
      />
      <h2 className="h4 mt-5 mb-3">{t("Rooms and shelves")}</h2>
      <div className="mb-3" style={{ maxWidth: 320 }}>
        <label htmlFor="locations-branch" className="form-label">
          {t("Branch")}
        </label>
        <select id="locations-branch" className="form-select" value={selected} onChange={(event) => setBranch(event.target.value)}>
          {branches.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {selected && <LocationsSection branch={selected} />}
    </>
  );
}
