import * as Styled from "./NameHeader.styled";

/** The melt filter's live primitives: the painter sets the warp, the name's measure sets the ramp to its size. */
export interface MeltFilter {
  warp: SVGFEDisplacementMapElement | null;
  /** How far down the letter box the warp ramps in, px. */
  front: SVGFEOffsetElement | null;
  /** How softly it ramps in, px. */
  soften: SVGFEGaussianBlurElement | null;
}

/**
 * The header's SVG filters (desktop only; phones skip them). `name-bevel`: a slight specular bevel on the chrome.
 * `name-melt`: turbulence displaces the molten glyph, weighted by a vertical ramp so the warp grows toward the foot
 * of the letter. The map is built opaque (0.5 + ramp × (noise − 0.5)) because feDisplacementMap reads it
 * unpremultiplied. No glow: its blur over every letter cost more GPU time than the rest of a run put together.
 */
const MatterFilters: React.FC<{ melt: MeltFilter }> = ({ melt }) => (
  <Styled.Defs aria-hidden="true" focusable="false">
    <defs>
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
      <filter id="name-melt" x="-15%" y="-10%" width="130%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045 0.012" numOctaves="2" seed="7" result="raw" />
        <feColorMatrix in="raw" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="noise" />
        <feFlood floodColor="#000000" result="black" />
        <feFlood floodColor="#ffffff" result="white" />
        <feOffset
          ref={(el) => {
            melt.front = el;
          }}
          in="white"
          dy="120"
          result="lower"
        />
        <feGaussianBlur
          ref={(el) => {
            melt.soften = el;
          }}
          in="lower"
          stdDeviation="0 30"
          result="soft"
        />
        <feMerge result="ramp">
          <feMergeNode in="black" />
          <feMergeNode in="soft" />
        </feMerge>
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
