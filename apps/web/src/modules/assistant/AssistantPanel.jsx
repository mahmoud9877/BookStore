import React, { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import BookCard from "../books/BookCard.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { askAssistant, getAssistantStatus } from "./assistant.service.js";
import { msg, t } from "../../i18n/index.js";

const EXAMPLES = [msg("A short science book I can borrow today"), msg("Novels about growing up in the American South"), msg("Something like Dune")];

/**
 * "Ask the catalogue": a natural-language question answered from the public
 * catalogue only. The API grounds the answer in real records; recommended
 * titles are listed first.
 */
export default function AssistantPanel({ onAddToCart, pendingId }) {
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const status = useQuery({ queryKey: ["assistant", "status"], queryFn: getAssistantStatus, staleTime: 5 * 60_000 });
  const ask = useMutation({ mutationFn: askAssistant });
  const result = ask.data;
  const isAi = status.data?.ai;

  function submit(event) {
    event.preventDefault();
    if (question.trim().length >= 3) ask.mutate(question.trim());
  }

  const recommended = new Set(result?.recommendedIds ?? []);

  return (
    <section className="card mb-4" aria-labelledby={`${inputId}-title`}>
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-2">
          <i className="bi bi-chat-square-text text-primary" aria-hidden="true"></i>
          <h2 id={`${inputId}-title`} className="h5 mb-0">
            {t("Ask the catalogue")}
          </h2>
          {status.data && (
            <span className="badge badge-soft" title={isAi ? t("Answers are written by an AI assistant from catalogue records") : t("Keyword search")}>
              {isAi ? t("AI assistant") : t("Keyword search")}
            </span>
          )}
        </div>
        <form onSubmit={submit} className="d-flex flex-column flex-sm-row gap-2">
          <label htmlFor={inputId} className="visually-hidden">
            {t("Describe what you are looking for")}
          </label>
          <input
            id={inputId}
            className="form-control"
            placeholder={t("Describe what you'd like to read")}
            maxLength={500}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" className="btn btn-primary text-nowrap" disabled={ask.isPending || question.trim().length < 3}>
            {ask.isPending ? <Spinner label={t("Searching")} /> : t("Ask")}
          </button>
        </form>
        {!result && !ask.error && (
          <p className="small text-muted mt-2 mb-0">
            {t("Try:")}{" "}
            {EXAMPLES.map((example, index) => (
              <React.Fragment key={example}>
                {index > 0 && " · "}
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setQuestion(example)}>
                  {t(example)}
                </button>
              </React.Fragment>
            ))}
          </p>
        )}
        {ask.error && (
          <p className="alert alert-warning mt-3 mb-0" role="alert">
            {ask.error?.response?.status === 429
              ? t("You've asked a lot of questions in a short time. Please wait a minute and try again.")
              : getErrorMessage(ask.error, t("The assistant couldn't answer. Please try again."))}
          </p>
        )}
        {result && (
          <div className="mt-3" aria-live="polite">
            <p className="mb-3" style={{ whiteSpace: "pre-line" }}>
              {result.answer}
            </p>
            {result.results.length > 0 && (
              <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
                {result.results.slice(0, 8).map((book) => (
                  <div className="col" key={book._id}>
                    <BookCard
                      book={book}
                      badge={recommended.has(String(book._id)) ? t("Recommended") : undefined}
                      onAddToCart={onAddToCart}
                      isAdding={pendingId === book._id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
