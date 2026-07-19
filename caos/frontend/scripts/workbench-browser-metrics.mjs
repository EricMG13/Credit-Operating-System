// Serializable browser-context probe shared by the Command, Monitor, and
// Profile validation scripts. Keep every helper inside the function because
// Playwright evaluates only this function body in the page realm.
export function readWorkbenchMetrics() {
  const rectFor = (selector) => document.querySelector(selector)?.getBoundingClientRect();
  const edge = (rect, key) => rect ? rect[key] : null;
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const rendered = style.display !== "none" && style.visibility !== "hidden";
    return rendered && rect.width > 0 && rect.height > 0;
  };
  const overlap = (decision, primary) => Boolean(decision && primary && decision.bottom > primary.top + 1);
  const decision = rectFor('.persona-workbench__slot--decision');
  const primary = rectFor('.persona-workbench__slot--primary');
  const tableOwners = Array.from(document.querySelectorAll('[data-caos-dominant-table-owner]')).filter(visible).length;
  const visibleSections = Array.from(document.querySelectorAll('[role="tabpanel"] > section')).filter(visible).length;
  return {
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    tableOwners,
    visibleSections,
    decisionBottom: edge(decision, "bottom"),
    primaryTop: edge(primary, "top"),
    overlap: overlap(decision, primary),
    scrollY: window.scrollY,
  };
}
