import joi from "joi";
import { RequestDto } from "../../../core/dto.js";

export class AskDto extends RequestDto {
  static schema = joi.object({ question: joi.string().trim().min(3).max(500).required() });
}

const STOP_WORDS = new Set(
  "a an and any are about books book by can do find for from give have i in is it looking me my of on or please recommend show some something that the to want what with you".split(" ")
);

/** Plain keyword extraction, used without an AI provider (or when it fails). */
export const keywordsOf = (question) =>
  question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .slice(0, 8)
    .join(" ");

/**
 * Natural-language catalogue search. With a language model configured, it
 * plans the search (filters), runs it against the public catalogue, then writes
 * an answer that may only cite the records it was given. Without one, it runs a
 * keyword search. It only ever sees public catalogue data — never member
 * records, loans or unpublished/staff material.
 */
export class CatalogAssistantService {
  #catalog;
  #categories;
  #model;

  constructor({ catalogService, categoryRepository, catalogModel = null }) {
    this.#catalog = catalogService;
    this.#categories = categoryRepository;
    this.#model = catalogModel;
  }

  get isAiEnabled() {
    return Boolean(this.#model);
  }

  async ask({ question }) {
    const categories = await this.#categories.list();
    const plan = this.#model ? await this.#model.plan(question, categories.map((category) => category.name)) : null;
    const filters = plan ? this.#filtersFrom(plan, categories) : { q: keywordsOf(question) };
    let { data: results } = await this.#catalog.search({ ...filters, sort: "relevance", page: 1, limit: 12 });
    if (!results.length && plan) {
      // The plan was too narrow: retry with the plain keywords.
      ({ data: results } = await this.#catalog.search({ q: keywordsOf(question), sort: "relevance", page: 1, limit: 12 }));
    }

    const written = this.#model && results.length ? await this.#model.answer(question, results.map(toRecord)) : null;
    const known = new Set(results.map((book) => String(book._id)));
    // Grounding check: only recommend ids that were actually in the results.
    const recommendedIds = (written?.recommendedIds ?? []).filter((id) => known.has(id));
    const ordered = recommendedIds.length
      ? [...recommendedIds.map((id) => results.find((book) => String(book._id) === id)), ...results.filter((book) => !recommendedIds.includes(String(book._id)))]
      : results;

    return {
      answer: written?.answer ?? fallbackAnswer(results),
      mode: written ? "ai" : "keyword",
      filters,
      recommendedIds,
      results: ordered,
    };
  }

  #filtersFrom(plan, categories) {
    const category = categories.find((item) => item.name.toLowerCase() === plan.category?.toLowerCase());
    return {
      ...(plan.query && { q: plan.query.slice(0, 200) }),
      ...(category && { category: String(category._id) }),
      ...(plan.language && { language: plan.language.slice(0, 40) }),
      ...(Number.isInteger(plan.yearFrom) && { yearFrom: plan.yearFrom }),
      ...(Number.isInteger(plan.yearTo) && { yearTo: plan.yearTo }),
      ...(plan.availableOnly && { available: true }),
    };
  }
}

const toRecord = (book) => ({
  _id: String(book._id),
  title: book.bookTitle,
  authors: book.author,
  category: book.category?.name,
  subjects: book.subjects,
  year: book.publicationYear,
  description: book.description?.slice(0, 400),
  copiesAvailable: book.availability?.available ?? 0,
  copiesTotal: book.availability?.total ?? 0,
});

const fallbackAnswer = (results) =>
  results.length
    ? `Here are ${results.length} catalogue record(s) matching your request.`
    : "Nothing in the catalogue matches that yet. Try other words, an author's name or an ISBN.";
