import * as Styled from "./NameHeader.styled";

/** The melt filter's live primitives: the painter sets the warp, the name's measure fits the ramp to the letters. */
export interface MeltFilter {
  warp: SVGFEDisplacementMapElement | null;
  /** The vertical ramp: a rect in the letters' user space (px from the letter box's top), sized by the measure. */
  ramp: SVGRectElement | null;
}

/**
 * The header's SVG filters (desktop only; phones skip them). `name-bevel`: a slight specular bevel on the chrome.
 * `name-melt`: turbulence displaces the molten glyph, weighted by a vertical ramp so the warp grows toward the foot
 * of the letter. The map is built opaque (0.5 + ramp × (noise − 0.5)) because feDisplacementMap reads it
 * unpremultiplied. The ramp is an feImage of a gradient rect in these defs: cheaper than flood + offset + blur
 * (same-session run at 1440×900: 91–99 → 106–115 fps) and than a data-URI image (re-rasterised on the main thread
 * every frame). Firefox can't draw an feImage of an element, so it skips the warp (`Molten`). No glow: its blur
 * cost more GPU time than the rest of a run.
 */
const MatterFilters: React.FC<{ melt: MeltFilter }> = ({ melt }) => (
  <Styled.Defs aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="name-ramp-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.35" stopColor="#000000" />
        <stop offset="0.65" stopColor="#ffffff" />
      </linearGradient>
      <rect
        ref={(el) => {
          melt.ramp = el;
        }}
        id="name-ramp"
        x="-3000"
        y="0"
        width="6000"
        height="300"
        fill="url(#name-ramp-fill)"
      />
      <filter id="name-bevel" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feSpecularLighting
          in="blur"
          surfaceScale="4"
          specularConstant="0.8"
          specularExponent="18"
          lightingColor="#ffffff"
          result="light"
        >
          <feDistantLight azimuth="225" elevation="42" />
        </feSpecularLighting>
        <feComposite in="light" in2="SourceAlpha" operator="in" result="shine" />
        <feComposite in="SourceGraphic" in2="shine" operator="arithmetic" k1="0" k2="1" k3="0.7" k4="0" />
      </filter>
      <filter id="name-melt" x="-8%" y="-5%" width="116%" height="115%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045 0.012" numOctaves="2" seed="7" result="raw" />
        <feColorMatrix in="raw" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="noise" />
        <feImage href="#name-ramp" result="ramp" />
        <feComposite in="noise" in2="ramp" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="map" />
        <feDisplacementMap
          ref={(el) => {
            melt.warp = el;
          }}
          in="SourceGraphic"
          in2="map"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </Styled.Defs>
);

export default MatterFilters;
