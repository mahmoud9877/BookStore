/**
 * In-page section links. The app uses hash routing (the URL hash is the route),
 * so "#features" cannot be a plain anchor: scroll to the section and move focus
 * to its heading for keyboard and screen-reader users.
 */
export function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const heading = section.querySelector("h2");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });
}

/** Props for a link to a section on the landing page. */
export const sectionLink = (id, onNavigate) => ({
  href: `#/?section=${id}`,
  onClick: (event) => {
    event.preventDefault();
    onNavigate?.();
    scrollToSection(id);
  },
});
