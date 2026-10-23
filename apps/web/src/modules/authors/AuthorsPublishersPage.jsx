import React, { useState } from "react";
import SimpleCrudSection from "./SimpleCrudSection.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { formatDate, formatName } from "../../lib/format.js";
import { msg, t } from "../../i18n/index.js";

const TABS = [
  {
    id: "authors",
    label: msg("Authors"),
    props: {
      entity: msg("Author"),
      queryKey: ["authors"],
      url: "/authors",
      searchPlaceholder: msg("Search authors"),
      fields: [
        { name: "name", label: msg("Name"), required: true },
        { name: "bio", label: msg("Biography"), type: "textarea" },
      ],
      columns: [
        { key: "name", header: msg("Name"), render: (author) => <span className="fw-semibold">{formatName(author.name)}</span> },
        { key: "createdAt", header: msg("Added"), hideBelow: "md", render: (author) => formatDate(author.createdAt) },
      ],
      toForm: (author) => ({ name: author.name ?? "", bio: author.bio ?? "" }),
    },
  },
  {
    id: "publishers",
    label: msg("Publishers"),
    props: {
      entity: msg("Publisher"),
      queryKey: ["publishers"],
      url: "/publishers",
      searchPlaceholder: msg("Search publishers"),
      fields: [
        { name: "name", label: msg("Name"), required: true },
        { name: "website", label: msg("Website"), type: "url", hint: msg("Optional, e.g. https://example.com") },
        { name: "country", label: msg("Country") },
      ],
      columns: [
        { key: "name", header: msg("Name"), render: (publisher) => <span className="fw-semibold">{publisher.name}</span> },
        { key: "country", header: msg("Country"), hideBelow: "md" },
        { key: "website", header: msg("Website"), hideBelow: "lg", render: (publisher) => publisher.website && <a href={publisher.website} target="_blank" rel="noreferrer">{publisher.website}</a> },
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
      <PageHeader title={t("Authors & publishers")} description={t("Books link to these records. Records still used by a book cannot be deleted.")} />
      <ul className="nav nav-tabs mb-3" role="tablist">
        {TABS.map((item) => (
          <li className="nav-item" key={item.id} role="presentation">
            <button type="button" role="tab" aria-selected={tab === item.id} className={`nav-link ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              {t(item.label)}
            </button>
          </li>
        ))}
      </ul>
      <SimpleCrudSection key={active.id} {...active.props} invalidate={[["books"]]} />
    </>
  );
}
