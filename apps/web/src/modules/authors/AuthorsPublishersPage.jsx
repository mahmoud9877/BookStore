import React, { useState } from "react";
import SimpleCrudSection from "./SimpleCrudSection.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { formatDate, formatName } from "../../lib/format.js";

const TABS = [
  {
    id: "authors",
    label: "Authors",
    props: {
      entity: "Author",
      queryKey: ["authors"],
      url: "/authors",
      searchPlaceholder: "Search authors",
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "bio", label: "Biography", type: "textarea" },
      ],
      columns: [
        { key: "name", header: "Name", render: (author) => <span className="fw-semibold">{formatName(author.name)}</span> },
        { key: "createdAt", header: "Added", hideBelow: "md", render: (author) => formatDate(author.createdAt) },
      ],
      toForm: (author) => ({ name: author.name ?? "", bio: author.bio ?? "" }),
    },
  },
  {
    id: "publishers",
    label: "Publishers",
    props: {
      entity: "Publisher",
      queryKey: ["publishers"],
      url: "/publishers",
      searchPlaceholder: "Search publishers",
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "website", label: "Website", type: "url", hint: "Optional, e.g. https://example.com" },
        { name: "country", label: "Country" },
      ],
      columns: [
        { key: "name", header: "Name", render: (publisher) => <span className="fw-semibold">{publisher.name}</span> },
        { key: "country", header: "Country", hideBelow: "md" },
        { key: "website", header: "Website", hideBelow: "lg", render: (publisher) => publisher.website && <a href={publisher.website} target="_blank" rel="noreferrer">{publisher.website}</a> },
      ],
      toForm: (publisher) => ({ name: publisher.name ?? "", website: publisher.website ?? "", country: publisher.country ?? "" }),
    },
  },
];

/** Staff page: the people and companies behind the catalogue. Referenced records cannot be deleted. */
export default function AuthorsPublishersPage() {
  const [tab, setTab] = useState("authors");
  const active = TABS.find((item) => item.id === tab);
  return (
    <>
      <PageHeader title="Authors & publishers" description="Books link to these records. Records still used by a book cannot be deleted." />
      <ul className="nav nav-tabs mb-3" role="tablist">
        {TABS.map((item) => (
          <li className="nav-item" key={item.id} role="presentation">
            <button type="button" role="tab" aria-selected={tab === item.id} className={`nav-link ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <SimpleCrudSection key={active.id} {...active.props} invalidate={[["books"]]} />
    </>
  );
}
