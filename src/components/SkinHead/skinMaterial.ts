/** The skin's roughness (the material's own) and the hair's, which the mesh's `_hairweight` blends toward. */
export const SKIN_ROUGHNESS = 0.55;
export const HAIR_ROUGHNESS = 0.85;
/** How much the atlas glows on its own, so the photo's baked lighting still reads in the dark scene. */
export const SKIN_GLOW = 0.18;

/**
 * Patches a MeshStandardMaterial's shaders (use as `onBeforeCompile`) so the mesh's `_hairweight` attribute (1 on hair)
 * roughens the hair, and the atlas adds a little of its own colour as emission.
 */
export function patchSkinHead(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = patch(shader.vertexShader, "#include <common>", "attribute float _hairweight;\nvarying float vHairWeight;");
  shader.vertexShader = patch(shader.vertexShader, "#include <uv_vertex>", "vHairWeight = _hairweight;");
  shader.fragmentShader = patch(shader.fragmentShader, "#include <common>", "varying float vHairWeight;");
  shader.fragmentShader = patch(
    shader.fragmentShader,
    "#include <roughnessmap_fragment>",
    `roughnessFactor = mix( roughnessFactor, ${HAIR_ROUGHNESS.toFixed(3)}, vHairWeight );`
  );
  shader.fragmentShader = patch(
    shader.fragmentShader,
    "#include <emissivemap_fragment>",
    `totalEmissiveRadiance += diffuseColor.rgb * ${SKIN_GLOW.toFixed(3)};`
  );
}

/** Appends `code` after a shader chunk include. */
function patch(source: string, chunk: string, code: string) {
  if (!source.includes(chunk)) throw new Error(`the three.js shader has no ${chunk} to patch the skin head into`);
  return source.replace(chunk, `${chunk}\n${code}`);
}
