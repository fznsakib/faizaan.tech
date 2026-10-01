import { ShaderLib } from "three";
import { describe, expect, it } from "vitest";

import { HAIR_ROUGHNESS, patchSkinHead, SKIN_GLOW } from "./skinMaterial";

const standard = () => ({ vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader });

describe("patchSkinHead", () => {
  it("passes the _hairweight attribute from the vertex to the fragment shader", () => {
    const shader = standard();
    patchSkinHead(shader);
    expect(shader.vertexShader).toContain("attribute float _hairweight;");
    expect(shader.vertexShader).toContain("vHairWeight = _hairweight;");
    expect(shader.fragmentShader).toContain("varying float vHairWeight;");
  });

  it("roughens the hair and lets the atlas glow a little, so its baked light reads in the dark scene", () => {
    const shader = standard();
    patchSkinHead(shader);
    expect(shader.fragmentShader).toContain(`roughnessFactor = mix( roughnessFactor, ${HAIR_ROUGHNESS.toFixed(3)}, vHairWeight );`);
    expect(shader.fragmentShader).toContain(`totalEmissiveRadiance += diffuseColor.rgb * ${SKIN_GLOW.toFixed(3)};`);
  });

  it("fails loudly when three.js no longer has a chunk it patches", () => {
    const shader = standard();
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "");
    expect(() => patchSkinHead(shader)).toThrow(/roughnessmap_fragment/);
  });
});
