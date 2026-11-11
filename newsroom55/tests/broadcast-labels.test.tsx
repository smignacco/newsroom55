import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveChannel } from "../src/components/newsroom/LiveChannel";
import { MarketTicker } from "../src/components/newsroom/MarketTicker";
import type { Quote } from "../src/lib/markets/provider";
import type { PublicChannel } from "../src/lib/video/player";

const channels: PublicChannel[] = [
  {
    id: 1,
    name: "Canal Savoir",
    adapter: "none",
    configured: false,
    isDefault: true,
    status: "ready",
  },
  {
    id: 2,
    name: "Télé-Québec",
    adapter: "none",
    configured: false,
    isDefault: false,
    status: "ready",
  },
];

const quote: Quote = {
  symbolId: 1,
  symbol: "CSCO",
  displayName: "Cisco Systems, Inc.",
  price: 82.51,
  changeAbs: 0.42,
  changePct: 0.51,
  currency: "USD",
  asOf: "2026-11-11T13:00:00Z",
  status: "DELAYED",
  provider: "cboe",
};

describe("broadcast labels", () => {
  it("identifies focus sources by screen number and channel name", () => {
    const html = renderToStaticMarkup(
      <LiveChannel
        channels={channels}
        selectedChannels={channels}
        audioChannelId={1}
        layoutMode="focus"
        focusChannelId={1}
        interacting={false}
        selectorOpen={false}
        onOpenSelector={vi.fn()}
        onCloseSelector={vi.fn()}
        onSelectChannels={vi.fn()}
        onPlaybackState={vi.fn()}
        muted={false}
        onToggleMute={vi.fn()}
        onFullscreen={vi.fn()}
      />,
    );

    expect(html).toContain("nr-multiview-focus");
    expect(html).toContain("ÉCRAN 01");
    expect(html).toContain("Canal Savoir");
  });

  it("shows the full company name beneath the ticker symbol", () => {
    const html = renderToStaticMarkup(
      <MarketTicker
        quotes={[quote]}
        board="DELAYED"
        providerName="Cboe"
        paused={false}
        onTogglePause={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(html).toContain('<span class="nr-sym">CSCO</span>');
    expect(html).toContain('<span class="nr-company">Cisco Systems, Inc.</span>');
  });
});
