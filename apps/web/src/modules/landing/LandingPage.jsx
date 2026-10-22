import React, { useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import "../../styles/landing.css";
import Brand from "../../components/ui/Brand.jsx";
import MarketingHeader, { SECTIONS } from "./MarketingHeader.jsx";
import ProductPreview from "./ProductPreview.jsx";
import { scrollToSection, sectionLink } from "./scroll.js";
import { AUDIENCES, BENEFITS, FEATURES, STEPS } from "./content.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";
import { t, useLanguage } from "../../i18n/index.js";

/** Fades sections in once as they scroll into view (skipped with reduced motion). */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const targets = root.querySelectorAll("[data-reveal]");
    targets.forEach((target) => target.classList.add("reveal"));
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px" }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  return ref;
}

function SectionHeading({ eyebrow, title, text, id }) {
  return (
    <div className="section-heading" data-reveal>
      <p className="eyebrow">{t(eyebrow)}</p>
      <h2 id={id} className="font-display">
        {t(title)}
      </h2>
      {text && <p className="lead-text">{t(text)}</p>}
    </div>
  );
}

/** The public product page at "/". */
export default function LandingPage() {
  const user = useAuthStore(selectUser);
  const rootRef = useReveal();
  const [params] = useSearchParams();
  const { language } = useLanguage();

  // "/?section=features" (shared links, footer links) scrolls to that section.
  useEffect(() => {
    const section = params.get("section");
    if (section) requestAnimationFrame(() => scrollToSection(section));
  }, [params]);

  // Catalogue links from before the catalogue moved to /catalog ("/?q=…&category=…").
  if (["q", "category", "sort", "available", "branch"].some((key) => params.has(key))) {
    return <Navigate to={`/catalog?${params.toString()}`} replace />;
  }

  return (
    <div className="landing" ref={rootRef}>
      <Helmet>
        <html lang={language} />
        <title>{t("BookSaw — library management for books, members, loans and branches")}</title>
        <meta
          name="description"
          content={t(
            "BookSaw brings the catalogue, circulation desk, members, inventory, branches, fines and reports of a library into one organized system, with a self-service portal for members."
          )}
        />
      </Helmet>
      <a href="#landing-main" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById("landing-main")?.focus(); }}>
        {t("Skip to content")}
      </a>
      <MarketingHeader />

      <main id="landing-main" tabIndex={-1}>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{t("Library management system")}</p>
              <h1 id="hero-title" className="font-display">
                {t("Books, members, loans and branches — in one organized system.")}
              </h1>
              <p className="hero-lead">
                {t(
                  "BookSaw runs the daily work of a library: cataloguing editions and copies, lending and returns at the desk, reservation queues, fines, stocktakes and purchasing — across every branch, with a portal where members manage their own loans."
                )}
              </p>
              <div className="hero-actions">
                {user ? (
                  <Link to="/catalog" className="btn btn-primary btn-lg">
                    {t("Go to the catalogue")}
                  </Link>
                ) : (
                  <Link to="/signup" className="btn btn-primary btn-lg">
                    {t("Get started")}
                  </Link>
                )}
                <a className="btn btn-outline-primary btn-lg" {...sectionLink("features")}>
                  {t("Explore features")}
                </a>
              </div>
              <p className="hero-note">
                {t("Already have an account?")} <Link to="/login">{t("Sign in")}</Link> · {t("or")}{" "}
                <Link to="/catalog">{t("search the catalogue")}</Link> {t("without one.")}
              </p>
            </div>
            <div className="hero-visual">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="features-title" id="features">
          <div className="container">
            <SectionHeading
              id="features-title"
              eyebrow="Features"
              title="Everything a library desk and back office need"
              text="Each module below is part of BookSaw today, enforced by the same permissions and rules on the server."
            />
            <ul className="feature-grid">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="feature-card" data-reveal>
                  <span className="feature-icon" aria-hidden="true">
                    <i className={`bi bi-${feature.icon}`}></i>
                  </span>
                  <h3>{t(feature.title)}</h3>
                  <p>{t(feature.text)}</p>
                </li>
              ))}
            </ul>
            <p className="small text-muted mt-4 mb-0">
              {t(
                "Online card payments and the natural-language catalogue assistant are optional: they are switched on when the library configures a payment provider or an AI provider."
              )}
            </p>
          </div>
        </section>

        <section className="landing-section band" aria-labelledby="desk-title">
          <div className="container split">
            <div data-reveal>
              <p className="eyebrow">{t("Built for the desk")}</p>
              <h2 id="desk-title" className="font-display">
                {t("Check out and return in two scans")}
              </h2>
              <p className="lead-text">
                {t(
                  "Type or scan a member card and a barcode. BookSaw checks the membership, the member's limits and any blocking fines, and refuses to lend a copy that is already out or held for someone else."
                )}
              </p>
              <ul className="check-list">
                <li>{t("Returned copies go straight to the next reservation, back home, or to the shelf.")}</li>
                <li>{t("Overdue fines are calculated from your policy at the moment of return.")}</li>
                <li>{t("Exceptions need a reason, and every one is written to the audit log.")}</li>
              </ul>
            </div>
            <div data-reveal>
              <ProductPreview variant="desk" />
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="modules-title" id="modules">
          <div className="container">
            <SectionHeading id="modules-title" eyebrow="How it works" title="From set-up to daily routine in four steps" />
            <ol className="steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="step" data-reveal>
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{t(step.title)}</h3>
                  <p>{t(step.text)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-section band" aria-labelledby="benefits-title" id="benefits">
          <div className="container">
            <SectionHeading id="benefits-title" eyebrow="Benefits" title="Less paperwork, clearer decisions" />
            <ul className="benefit-grid">
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className="benefit" data-reveal>
                  <i className={`bi bi-${benefit.icon}`} aria-hidden="true"></i>
                  <div>
                    <h3>{t(benefit.title)}</h3>
                    <p>{t(benefit.text)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="audience-title" id="audience">
          <div className="container">
            <SectionHeading
              id="audience-title"
              eyebrow="Who it's for"
              title="For libraries of different shapes and sizes"
              text="What fits depends on your policies — membership types, fines and permissions are configured by each library, not built in."
            />
            <ul className="audience-grid">
              {AUDIENCES.map((audience) => (
                <li key={audience.title} className="audience-card" data-reveal>
                  <i className={`bi bi-${audience.icon}`} aria-hidden="true"></i>
                  <h3>{t(audience.title)}</h3>
                  <p>{t(audience.text)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="about-title" id="about">
          <div className="container">
            <div className="cta-panel" data-reveal>
              <div>
                <h2 id="about-title" className="font-display">
                  {t("About BookSaw")}
                </h2>
                <p>
                  {t(
                    "BookSaw started as an online bookstore and grew into a complete library system. The shop still works: titles marked for sale can be bought, while every title can be borrowed and reserved."
                  )}
                </p>
              </div>
              <div className="cta-actions">
                {user ? (
                  <Link to="/catalog" className="btn btn-light btn-lg">
                    {t("Go to the catalogue")}
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" className="btn btn-light btn-lg">
                      {t("Create an account")}
                    </Link>
                    <Link to="/catalog" className="btn btn-outline-light btn-lg">
                      {t("Browse the catalogue")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="container footer-grid">
          <div>
            <Brand to="/" />
            <p className="mt-3 mb-0">{t("A library management system for catalogue, circulation, members and branches.")}</p>
          </div>
          <nav aria-label={t("Product")}>
            <h2 className="footer-title">{t("Product")}</h2>
            <ul>
              {SECTIONS.slice(0, 4).map(({ id, label }) => (
                <li key={id}>
                  <a {...sectionLink(id)}>{t(label)}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t("Library")}>
            <h2 className="footer-title">{t("Library")}</h2>
            <ul>
              <li><Link to="/catalog">{t("Catalogue")}</Link></li>
              <li><Link to="/digital">{t("Digital library")}</Link></li>
              <li><Link to="/events">{t("Events")}</Link></li>
            </ul>
          </nav>
          <nav aria-label={t("Account")}>
            <h2 className="footer-title">{t("Account")}</h2>
            <ul>
              <li><Link to="/login">{t("Sign in")}</Link></li>
              <li><Link to="/signup">{t("Create an account")}</Link></li>
              <li><Link to="/account">{t("My library")}</Link></li>
            </ul>
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} BookSaw</span>
        </div>
      </footer>
    </div>
  );
}
