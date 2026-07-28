import {useEffect, useRef, useState} from 'react';
import {Link, useFetcher, useLoaderData, useSearchParams} from 'react-router';
import {CartForm, Money} from '@shopify/hydrogen';
import type {Route} from './+types/custom-print_.design';

/**
 * Design studio — Fabric.js editor over the REAL Shopify bandana product
 * (`custom-print-solid-bandana`). The chosen variant's photo is the mockup;
 * the customer drops artwork / text into the centred print area. "Add to cart"
 * exports the print PNG, uploads it to the backend (/api/upload-design → R2),
 * and captures the variant + design-file URL as line-item attributes.
 *
 * Interaction: Fabric backstore is sized 1:1 to its displayed pixels so pointer
 * coordinates map exactly.
 */
const HANDLE = 'custom-print-solid-bandana';
const AREA = {frac: 0.42, cx: 0.5, cy: 0.46}; // centred print zone over the photo

export const meta: Route.MetaFunction = () => [
  {title: 'Design studio — Berlin Houseware'},
  {name: 'robots', content: 'noindex'},
];

export async function loader({context}: Route.LoaderArgs) {
  const {product} = await context.storefront.query(STUDIO_QUERY, {
    variables: {handle: HANDLE},
  });
  if (!product) throw new Response('Product not found', {status: 404});
  return {product};
}

export default function DesignStudio() {
  const {product} = useLoaderData<typeof loader>();
  const variants = product.variants.nodes;
  const [params] = useSearchParams();
  const [variant, setVariant] = useState(
    variants.find((v) => v.id === params.get('variant')) ?? variants[0],
  );
  const [text, setText] = useState('BERLIN');
  const [objColor, setObjColor] = useState('#ffffff');
  const [ready, setReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasObjects, setHasObjects] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [added, setAdded] = useState<{
    previewUrl: string;
    backendUrl: string | null;
    backendMsg: string;
    attributes: Array<{key: string; value: string}>;
  } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fx = useRef<{fabric: any; canvas: any} | null>(null);
  const cartFetcher = useFetcher();
  const addingToCart = cartFetcher.state !== 'idle';

  const colorName =
    variant.selectedOptions.find((o) => o.name === 'Color')?.value ??
    variant.title;
  const mockUrl = variant.image?.url ?? product.images.nodes[0]?.url;

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;
    let ro: ResizeObserver | null = null;
    (async () => {
      const fabric = await import('fabric');
      if (disposed || !canvasElRef.current || !stageRef.current) return;
      canvas = new fabric.Canvas(canvasElRef.current, {
        preserveObjectStacking: true,
        backgroundColor: 'rgba(0,0,0,0)',
      });
      fx.current = {fabric, canvas};
      const fit = () => {
        const w = Math.round(stageRef.current!.clientWidth);
        if (w > 0) canvas.setDimensions({width: w, height: w});
      };
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(stageRef.current);
      const sync = () => {
        setHasObjects(canvas.getObjects().length > 0);
        setHasSelection(Boolean(canvas.getActiveObject()));
      };
      ['object:added', 'object:removed', 'selection:created', 'selection:updated', 'selection:cleared'].forEach(
        (e) => canvas.on(e, sync),
      );
      setReady(true);
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      canvas?.dispose?.();
      fx.current = null;
    };
  }, []);

  function center() {
    const c = fx.current!.canvas;
    return {
      x: c.getWidth() * AREA.cx,
      y: c.getHeight() * AREA.cy,
      areaW: c.getWidth() * AREA.frac,
    };
  }

  async function addImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !fx.current) return;
    const {fabric, canvas} = fx.current;
    const url = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
    // Load the element fully BEFORE handing it to Fabric — fromURL can resolve
    // before the image has real dimensions (→ nothing renders).
    const el = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const img = new fabric.FabricImage(el, {
      originX: 'center',
      originY: 'center',
    });
    const {x, y, areaW} = center();
    img.scaleToWidth(areaW * 0.7);
    img.set({left: x, top: y});
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    setAdded(null);
    e.target.value = '';
  }

  function addText() {
    if (!fx.current || !text.trim()) return;
    const {fabric, canvas} = fx.current;
    const {x, y, areaW} = center();
    const t = new fabric.IText(text.trim(), {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 800,
      fontSize: areaW * 0.16,
      fill: objColor,
      textAlign: 'center',
    });
    canvas.add(t);
    canvas.setActiveObject(t);
    canvas.renderAll();
    setAdded(null);
  }

  function applyColor(hex: string) {
    setObjColor(hex);
    const c = fx.current?.canvas;
    const o = c?.getActiveObject();
    if (o) {
      o.set('fill', hex);
      c.renderAll();
    }
  }

  function deleteSelected() {
    const c = fx.current?.canvas;
    if (!c) return;
    c.getActiveObjects().forEach((o: unknown) => c.remove(o));
    c.discardActiveObject();
    c.renderAll();
  }

  function exportPrint(): string {
    const c = fx.current?.canvas;
    if (!c || c.getObjects().length === 0) return '';
    c.discardActiveObject();
    c.renderAll();
    const w = c.getWidth();
    const areaW = w * AREA.frac;
    return c.toDataURL({
      format: 'png',
      multiplier: 1200 / areaW,
      left: w * AREA.cx - areaW / 2,
      top: c.getHeight() * AREA.cy - areaW / 2,
      width: areaW,
      height: areaW,
    });
  }

  async function addToCart() {
    const previewUrl = exportPrint();
    if (!previewUrl) return;
    setUploading(true);
    let backendUrl: string | null = null;
    let backendMsg = '';
    try {
      const res = await fetch('/api/upload-design', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({image: previewUrl, filename: `bandana-${colorName}.png`}),
      });
      const j = (await res.json()) as {stored?: boolean; url?: string; message?: string; bytes?: number};
      backendUrl = j.url ?? null;
      backendMsg = j.stored ? `Stored (${j.bytes} bytes)` : j.message ?? 'Received by backend';
    } catch (e) {
      backendMsg = `Upload failed: ${(e as Error).message}`;
    }
    setUploading(false);

    // Add the real variant to the Shopify cart with the design as line-item
    // attributes → they flow through to checkout and the order.
    const designValue = backendUrl ?? '(upload failed)';
    cartFetcher.submit(
      {
        [CartForm.INPUT_NAME]: JSON.stringify({
          action: CartForm.ACTIONS.LinesAdd,
          inputs: {
            lines: [
              {
                merchandiseId: variant.id,
                quantity: 1,
                attributes: [
                  {key: 'Color', value: colorName},
                  {key: 'Print technique', value: 'DTG'},
                  {key: 'Design file', value: designValue},
                ],
              },
            ],
          },
        }),
      },
      {method: 'POST', action: '/cart'},
    );

    setAdded({
      previewUrl,
      backendUrl,
      backendMsg,
      attributes: [
        {key: 'Product', value: product.title},
        {key: 'Color', value: colorName},
        {key: 'Design file', value: designValue},
      ],
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-paper text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3">
        <p className="truncate text-sm font-bold uppercase tracking-tight">
          {product.title} · Design studio
        </p>
        <Link to="/custom-print" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-mint">
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Stage */}
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#f6f6f5] p-6">
          <div ref={stageRef} className="relative aspect-square w-full max-w-[540px] overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
            {mockUrl && (
              <img
                src={`${mockUrl}${mockUrl.includes('?') ? '&' : '?'}width=1000`}
                alt={product.title}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 [&_.canvas-container]:!absolute [&_.canvas-container]:!inset-0">
              <canvas ref={canvasElRef} />
            </div>
            <div
              className="pointer-events-none absolute rounded-md border border-dashed border-white/70 mix-blend-difference"
              style={{
                left: `${(AREA.cx - AREA.frac / 2) * 100}%`,
                top: `${(AREA.cy - AREA.frac / 2) * 100}%`,
                width: `${AREA.frac * 100}%`,
                aspectRatio: '1 / 1',
              }}
            >
            </div>
            {/* Unmissable in-canvas upload prompt (Printful-style) */}
            {ready && !hasObjects && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute grid place-items-center rounded-full bg-brand-700/90 text-center text-white shadow-lg backdrop-blur-sm transition hover:bg-brand-800"
                style={{
                  left: `${AREA.cx * 100}%`,
                  top: `${AREA.cy * 100}%`,
                  width: `${AREA.frac * 0.9 * 100}%`,
                  aspectRatio: '1 / 1',
                  transform: 'translate(-50%,-50%)',
                }}
              >
                <span className="flex flex-col items-center gap-1 px-3">
                  <svg viewBox="0 0 24 24" className="h-7 w-7">
                    <path d="M12 16V4m0 0L8 8m4-4 4 4M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Upload your design
                  </span>
                </span>
              </button>
            )}
            {!ready && (
              <div className="absolute inset-0 grid place-items-center bg-white/60 text-sm text-muted">
                Loading editor…
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            Drag · resize · rotate
            <button onClick={deleteSelected} disabled={!hasSelection} className="btn btn-outline !px-3 !py-1.5 text-xs disabled:opacity-40">
              Delete selected
            </button>
          </div>
        </main>

        {/* Controls */}
        <aside className="w-full shrink-0 space-y-6 overflow-y-auto border-t border-black/10 p-6 lg:w-80 lg:border-l lg:border-t-0">
          {/* Shared hidden file input — triggered from here and the canvas */}
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={addImage}
            className="hidden"
          />
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide">Artwork</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-black/25 bg-mint/50 px-4 py-6 text-center hover:border-ink hover:bg-mint"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand-700">
                <path d="M12 16V4m0 0L8 8m4-4 4 4M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-semibold">Upload image</span>
              <span className="text-xs text-muted">PNG or JPG</span>
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide">Text</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type text"
                className="!mt-0 !mb-0 min-w-0 flex-1 rounded-xl !border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:!border-brand-500"
              />
              <button onClick={addText} disabled={!ready || !text.trim()} className="btn btn-dark !px-4 !py-2 text-sm disabled:opacity-40">
                Add
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm font-semibold">Color</span>
              <input type="color" value={objColor} onChange={(e) => applyColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-black/15" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wide">Bandana</p>
              <span className="text-xs text-muted">{colorName}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v)}
                  aria-label={v.title}
                  className={`h-10 w-10 overflow-hidden rounded-full ring-offset-2 ${variant.id === v.id ? 'ring-2 ring-ink' : 'ring-1 ring-black/15'}`}
                >
                  {v.image?.url && (
                    <img src={`${v.image.url}${v.image.url.includes('?') ? '&' : '?'}width=80`} alt={v.title} className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between border-t border-black/10 px-6 py-3">
        <p className="text-sm text-muted">{colorName}</p>
        <div className="flex items-center gap-4">
          <span className="text-lg font-extrabold">
            <Money data={variant.price} as="span" />
          </span>
          <button onClick={addToCart} disabled={!hasObjects || uploading} className="btn btn-dark disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Add to cart'}
          </button>
        </div>
      </footer>

      {/* Added confirmation */}
      {added && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-paper">
            <div className="flex items-center gap-3 border-b border-black/10 bg-mint px-6 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-white">
                {addingToCart ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="m5 13 4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </span>
              <p className="font-bold uppercase tracking-tight">
                {addingToCart ? 'Adding to cart…' : 'Added to your cart'}
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-4">
                <img
                  src={added.backendUrl ?? added.previewUrl}
                  alt="Design"
                  className="h-28 w-28 shrink-0 rounded-xl bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] object-contain p-1 ring-1 ring-black/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Backend</p>
                  <p className="mt-1 text-sm">{added.backendMsg}</p>
                  {added.backendUrl && (
                    <a href={added.backendUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-brand-700 underline">
                      {added.backendUrl}
                    </a>
                  )}
                </div>
              </div>
              <dl className="mt-5 divide-y divide-black/10 rounded-2xl border border-black/10">
                {added.attributes.map((a) => (
                  <div key={a.key} className="grid grid-cols-3 gap-3 px-4 py-2.5">
                    <dt className="font-mono text-xs text-muted">{a.key}</dt>
                    <dd className="col-span-2 break-all text-sm">{a.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">
                Added to your Shopify cart as a line-item attribute — it carries
                through to checkout and appears on the order.
              </p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => setAdded(null)} className="btn btn-outline flex-1">
                  Keep editing
                </button>
                <Link to="/cart" className="btn btn-dark flex-1">
                  View cart &amp; checkout
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STUDIO_QUERY = `#graphql
  query StudioBandana(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      images(first: 6) {
        nodes {
          url
        }
      }
      variants(first: 20) {
        nodes {
          id
          title
          image {
            url
          }
          price {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
` as const;
