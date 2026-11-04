import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VisitList } from "../src/components/visit-list";
import RestaurantPage from "../src/app/(journal)/places/[id]/page";
import JournalPage from "../src/app/(journal)/journal/page";
import { journalFixture, placeA, placeB, visit } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("Not found");
  },
}));
const data = vi.hoisted(() => ({ getJournal: vi.fn() }));
vi.mock("@/lib/data", () => ({ getJournal: data.getJournal }));
vi.mock("@/lib/profile", () => ({
  requireProfile: async () => ({ id: "hieu", name: "Hieu" }),
}));

const first = visit({ profileId: "nick" });
const second = visit({
  id: "20000000-0000-4000-8000-000000000002",
  profileId: "vinh",
});
const own = visit({
  id: "20000000-0000-4000-8000-000000000003",
  profileId: "hieu",
  visitDate: "2024-01-01",
});

function feed(
  visible: ReturnType<typeof visit>[],
  allVisits = visible,
  showPlace = true,
) {
  const journal = journalFixture(allVisits);
  return renderToStaticMarkup(
    createElement(VisitList, {
      visits: visible,
      allVisits,
      profiles: journal.profiles,
      restaurants: journal.restaurants,
      selectedProfileId: "hieu",
      showPlace,
      controls: true,
    }),
  );
}
const invitationCount = (markup: string) =>
  markup.split("Review this place too").length - 1;

describe("journal search refinements", () => {
  it("preserves the search when switching between everyone and personal reviews", async () => {
    data.getJournal.mockResolvedValue(journalFixture([first, own]));
    const page = await JournalPage({
      searchParams: Promise.resolve({ q: "noodles & coffee" }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain(
      'href="/journal?view=personal&amp;q=noodles+%26+coffee"',
    );
    expect(html).toContain('href="/journal?q=noodles+%26+coffee"');
  });
  it("clears only the search while retaining the personal review scope", async () => {
    data.getJournal.mockResolvedValue(journalFixture([first, own]));
    const page = await JournalPage({
      searchParams: Promise.resolve({
        view: "personal",
        q: "no matching meal",
      }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain('href="/journal?view=personal"');
    expect(html).toContain('aria-label="Clear search"');
    expect(html).toContain('name="view" value="personal"');
  });
});

describe("review invitations", () => {
  it("offers one invitation for multiple friends reviewing an unreviewed place", () => {
    expect(invitationCount(feed([first, second]))).toBe(1);
  });
  it("hides invitations when an older personal review is outside the visible feed", () => {
    expect(invitationCount(feed([first, second], [first, second, own]))).toBe(
      0,
    );
  });
  it("checks the selected friend and the particular place separately", () => {
    const elsewhere = { ...second, restaurantId: placeB };
    const html = feed([first, elsewhere], [first, elsewhere, own]);
    expect(invitationCount(html)).toBe(1);
    expect(html).toContain(`href="/places/${placeB}/visits/new"`);
    expect(html).not.toContain(`href="/places/${placeA}/visits/new"`);
  });
  it("keeps editing available for your own review", () => {
    const html = feed([own, first]);
    expect(invitationCount(html)).toBe(0);
    expect(html).toContain(`href="/visits/${own.id}/edit"`);
  });
  it("does not repeat the place page's main review action within its history", () => {
    expect(invitationCount(feed([first, second], [first, second], false))).toBe(
      0,
    );
  });
});

describe("place page review action", () => {
  it.each([
    { rows: [], label: "Add your review" },
    { rows: [first, second], label: "Add your review" },
    { rows: [own, first, second], label: "Review another visit" },
  ])("has one main action: $label", async ({ rows, label }) => {
    data.getJournal.mockResolvedValue(journalFixture(rows));
    const page = await RestaurantPage({
      params: Promise.resolve({ id: placeA }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);
    expect(html.split(`href="/places/${placeA}/visits/new"`).length - 1).toBe(
      1,
    );
    expect(html).toContain(label);
    expect(invitationCount(html)).toBe(0);
    if (rows.includes(own))
      expect(html).toContain(`href="/visits/${own.id}/edit"`);
  });
});
