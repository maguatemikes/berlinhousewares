import {useEffect, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';

type GalleryImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

export function ProductGallery({
  images,
  title,
  activeImageUrl,
}: {
  images: GalleryImage[];
  title: string;
  activeImageUrl?: string | null;
}) {
  const [active, setActive] = useState(0);

  // Refs to each rail *container* (desktop vertical / mobile horizontal). We
  // scroll the active child into view — a container ref avoids the shared-ref
  // pitfall of putting one ref on whichever button is active.
  const railRef = useRef<HTMLDivElement | null>(null);
  const mobileRailRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);
  const didImgMountRef = useRef(false);

  // When the selected variant changes, jump the gallery to that variant's image.
  // Only re-runs when the variant image URL changes (not on every images rebuild),
  // so manually clicking a thumbnail isn't instantly overridden.
  useEffect(() => {
    if (!activeImageUrl) return;
    const idx = images.findIndex((img) => img.url === activeImageUrl);
    if (idx >= 0) setActive(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImageUrl]);

  // When the variant IMAGE changes (a swatch that actually changes the photo),
  // bring the main image into view — but ONLY if it's mostly scrolled off-screen,
  // so it never yanks the page when the gallery is already visible (e.g. the
  // desktop sticky column). Fires on the image URL rather than `active`, so Size/
  // Packaging picks that keep the same photo don't scroll. Skips first mount and
  // honours reduced-motion. (The old `block:'nearest'` thumbnail scroll was a
  // no-op whenever the target was already partly in view — this is the real fix.)
  useEffect(() => {
    if (!activeImageUrl) return;
    if (!didImgMountRef.current) {
      didImgMountRef.current = true;
      return;
    }
    const el = mainRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    // Skip only when the image's TOP is already comfortably visible (at/below the
    // sticky header). This covers the desktop sticky column (top ≈ top-28) and the
    // just-landed state. Otherwise the top is cut off above the header (even if the
    // image is "mostly" visible, since it's taller than the viewport) → scroll it
    // back so the new variant photo reads from the top.
    const headerOffset = 80;
    if (rect.top >= headerOffset) return;
    el.scrollIntoView({behavior: 'auto', block: 'start'});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImageUrl]);

  // Slide the rail so the active thumbnail is in view whenever the selection
  // changes (swatch, arrow, or thumb tap). Skips the first mount so it never
  // scrolls the page on load, and honours reduced-motion. Reacts to `active`
  // only — the variant→image logic above is left exactly as-is.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    // Scroll the rail INTERNALLY (its own scrollLeft/scrollTop) to reveal the
    // active thumbnail — never `scrollIntoView`, which bubbles up and scrolls the
    // WINDOW. That window scroll was fighting the page-level gallery reveal above
    // and is why clicking a 2nd-row swatch (whose thumbnail sits far down/along
    // the rail, off-screen) lost the scroll.
    const reveal = (rail: HTMLDivElement | null) => {
      if (!rail || rail.offsetParent === null) return;
      const idx = Math.min(active, rail.children.length - 1);
      const child = rail.children[idx] as HTMLElement | undefined;
      if (!child) return;
      const c = child.getBoundingClientRect();
      const r = rail.getBoundingClientRect();
      if (rail.scrollWidth > rail.clientWidth + 1) {
        const left =
          rail.scrollLeft + (c.left - r.left) - (rail.clientWidth - c.width) / 2;
        rail.scrollTo({left: Math.max(0, left), behavior});
      } else {
        const top =
          rail.scrollTop + (c.top - r.top) - (rail.clientHeight - c.height) / 2;
        rail.scrollTo({top: Math.max(0, top), behavior});
      }
    };
    reveal(railRef.current);
    reveal(mobileRailRef.current);
  }, [active]);

  if (!images.length) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-3xl bg-mint text-brand-600">
        <span className="text-sm font-bold lowercase">berlinhouseware</span>
      </div>
    );
  }

  const safeActive = Math.min(active, images.length - 1);
  const main = images[safeActive];
  const go = (dir: number) =>
    setActive((i) => (i + dir + images.length) % images.length);

  return (
    <div>
      <div className="flex gap-4">
        {/* Vertical thumbnail rail (desktop) — always visible; a single-image
            product shows its main image as the one thumbnail. Caps at ~4 then
            scrolls (scrollbar hidden). */}
        <div
          ref={railRef}
          className="no-scrollbar hidden max-h-[356px] w-20 shrink-0 flex-col gap-3 overflow-y-auto md:flex"
        >
          {images.map((img, i) => (
              <button
                key={img.id ?? i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === safeActive}
                className={`aspect-square shrink-0 overflow-hidden rounded-xl border bg-mint transition ${
                  i === safeActive
                    ? 'border-black/40'
                    : 'border-black/10 opacity-70 hover:opacity-100'
                }`}
              >
                <Image
                  data={img}
                  width={80}
                  height={80}
                  sizes="80px"
                  className="h-full w-full object-cover"
                  alt={img.altText || `${title} thumbnail ${i + 1}`}
                />
              </button>
          ))}
        </div>

        {/* Main image */}
        <div ref={mainRef} className="relative flex-1 scroll-mt-24 md:scroll-mt-28">
          <div className="aspect-square overflow-hidden rounded-3xl bg-mint">
            <Image
              data={main}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="h-full w-full object-cover"
              alt={main.altText || title}
            />
          </div>

          {images.length > 1 && (
            <>
              <GalleryArrow side="left" onClick={() => go(-1)} />
              <GalleryArrow side="right" onClick={() => go(1)} />
            </>
          )}
        </div>
      </div>

      {/* Horizontal thumbnails (mobile) */}
      {images.length > 1 && (
        <div
          ref={mobileRailRef}
          className="no-scrollbar mt-3 flex gap-3 overflow-x-auto md:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-mint ${
                i === safeActive ? 'border-black/40' : 'border-black/10 opacity-70'
              }`}
            >
              <Image
                data={img}
                width={64}
                height={64}
                sizes="64px"
                className="h-full w-full object-cover"
                alt={img.altText || `${title} thumbnail ${i + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
      className={`absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-md transition hover:bg-mint ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d={side === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
