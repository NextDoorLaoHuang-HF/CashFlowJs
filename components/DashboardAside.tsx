"use client";

import { clsx } from "clsx";
import { useIsMobile } from "../lib/hooks/useIsMobile";
import { Accordion, type AccordionItem } from "./Accordion";
import { PlayerSidebar } from "./PlayerSidebar";
import { PortfolioPanel } from "./PortfolioPanel";
import { JointVenturesPanel } from "./JointVenturesPanel";
import { LoansPanel } from "./LoansPanel";
import { LLMPanel } from "./LLMPanel";
import { ReplayPanel } from "./ReplayPanel";
import { t } from "../lib/i18n";
import type { Locale } from "../lib/types";

function buildAccordionItems(locale: Locale): AccordionItem[] {
  return [
    {
      id: "players",
      title: t(locale, "players.title"),
      body: <PlayerSidebar />,
      defaultOpen: true,
    },
    {
      id: "portfolio",
      title: t(locale, "portfolio.title"),
      body: <PortfolioPanel />,
      defaultOpen: true,
    },
    {
      id: "ventures",
      title: t(locale, "ventures.title"),
      body: <JointVenturesPanel />,
      defaultOpen: false,
    },
    {
      id: "loans",
      title: t(locale, "loans.title"),
      body: <LoansPanel />,
      defaultOpen: false,
    },
    {
      id: "llm",
      title: t(locale, "llm.title"),
      body: <LLMPanel />,
      defaultOpen: false,
    },
    {
      id: "replay",
      title: t(locale, "replay.title"),
      body: <ReplayPanel />,
      defaultOpen: false,
    },
  ];
}

type DashboardAsideProps = {
  locale: Locale;
  className?: string;
};

export function DashboardAside({ locale, className }: DashboardAsideProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <Accordion items={buildAccordionItems(locale)} className={className} />;
  }

  return (
    <div className={clsx("dashboard-aside", className)}>
      <PlayerSidebar />
      <PortfolioPanel />
      <JointVenturesPanel />
      <LoansPanel />
      <LLMPanel />
      <ReplayPanel />
    </div>
  );
}
