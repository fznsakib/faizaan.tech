import { ShaderLib } from "three";
import { describe, expect, it } from "vitest";

import { patchFaceSkin } from "./faceSkin";

const standard = () => ({ vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader });

describe("patchFaceSkin", () => {
  it("passes the _faceweight attribute from the vertex to the fragment shader", () => {
    const shader = standard();
    patchFaceSkin(shader);
    expect(shader.vertexShader).toContain("attribute float _faceweight;");
    expect(shader.vertexShader).toContain("vFaceWeight = _faceweight;");
    expect(shader.fragmentShader).toContain("varying float vFaceWeight;");
  });

  it("blends colour, roughness, metalness and emission from chrome to the skin map by the weight", () => {
    const shader = standard();
    patchFaceSkin(shader);
    expect(shader.fragmentShader).not.toContain("#include <map_fragment>");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = mix( diffuseColor.rgb, faceSkin, vFaceWeight );");
    expect(shader.fragmentShader).toMatch(/metalnessFactor = mix\( metalnessFactor, 0\.0, vFaceWeight \);/);
    expect(shader.fragmentShader).toMatch(/roughnessFactor = mix\( roughnessFactor, [\d.]+, vFaceWeight \);/);
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance = mix\( totalEmissiveRadiance, faceSkin \* [\d.]+, vFaceWeight \);/);
  });

  it("fails loudly when three.js no longer has a chunk it patches", () => {
    const shader = standard();
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "");
    expect(() => patchFaceSkin(shader)).toThrow(/map_fragment/);
  });
});
