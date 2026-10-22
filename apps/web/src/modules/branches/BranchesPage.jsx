import React, { useState } from "react";
import SimpleCrudSection from "../authors/SimpleCrudSection.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { humanize } from "../../lib/format.js";
import { useActiveBranches, useLocations } from "./branch.queries.js";

const BRANCH_FIELDS = [
  { name: "code", label: "Code", required: true, hint: "Short and unique, e.g. MAIN. Used in barcodes." },
  { name: "name", label: "Name", required: true },
  { name: "address", label: "Address" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" },
  { name: "isActive", label: "Open (accepts pickups and returns)", type: "checkbox" },
];

const BRANCH_COLUMNS = [
  { key: "code", header: "Code", render: (branch) => <span className="scan-input fw-semibold">{branch.code}</span> },
  { key: "name", header: "Name" },
  { key: "address", header: "Address", hideBelow: "md" },
  { key: "isActive", header: "Status", render: (branch) => <StatusBadge status={branch.isActive ? "active" : "closed"} label={branch.isActive ? "Open" : "Closed"} /> },
];

/** Rooms and shelves of one branch. A shelf may sit in a room. */
function LocationsSection({ branch }) {
  const rooms = useLocations(branch).data.filter((location) => location.type === "room");
  const roomName = (id) => rooms.find((room) => room._id === id)?.code ?? "";
  return (
    <SimpleCrudSection
      key={branch}
      entity="Location"
      queryKey={["locations", "admin", branch]}
      url="/locations"
      filters={{ branch }}
      invalidate={[["locations"]]}
      searchPlaceholder="Search rooms and shelves"
      fields={[
        { name: "type", label: "Type", type: "select", required: true, options: [{ value: "room", label: "Room" }, { value: "shelf", label: "Shelf" }] },
        { name: "code", label: "Code", required: true, hint: "e.g. A or A-01" },
        { name: "name", label: "Name" },
        { name: "parent", label: "In room (shelves only)", type: "select", options: rooms.map((room) => ({ value: room._id, label: `${room.code} ${room.name ?? ""}` })) },
      ]}
      columns={[
        { key: "code", header: "Code", render: (location) => <span className="scan-input fw-semibold">{location.code}</span> },
        { key: "type", header: "Type", render: (location) => humanize(location.type) },
        { key: "name", header: "Name", hideBelow: "md" },
        { key: "parent", header: "Room", hideBelow: "md", render: (location) => roomName(location.parent) },
      ]}
      toForm={(location) => ({ type: location.type ?? "shelf", code: location.code ?? "", name: location.name ?? "", parent: location.parent ?? "" })}
      fromForm={(values, existing) => ({
        ...(existing._id ? {} : { branch }),
        type: values.type,
        code: values.code,
        name: values.name,
        parent: values.type === "shelf" && values.parent ? values.parent : null,
      })}
      empty={{ icon: "bookshelf", title: "No rooms or shelves yet", message: "Add a room, then the shelves in it." }}
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
      <PageHeader title="Branches & shelves" description="Each copy belongs to a branch and may sit on a shelf." />
      <SimpleCrudSection
        entity="Branch"
        queryKey={["branches", "admin"]}
        url="/branches"
        invalidate={[["branches"]]}
        searchPlaceholder="Search branches"
        fields={BRANCH_FIELDS}
        columns={BRANCH_COLUMNS}
        toForm={(record) => ({ code: record.code ?? "", name: record.name ?? "", address: record.address ?? "", phone: record.phone ?? "", email: record.email ?? "", isActive: record.isActive ?? true })}
      />
      <h2 className="h4 mt-5 mb-3">Rooms and shelves</h2>
      <div className="mb-3" style={{ maxWidth: 320 }}>
        <label htmlFor="locations-branch" className="form-label">
          Branch
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
