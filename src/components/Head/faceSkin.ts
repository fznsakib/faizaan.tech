/** The photo skin's roughness, and how much it glows on its own so its baked lighting still reads in the dark scene. */
export const FACE_ROUGHNESS = 0.55;
export const FACE_GLOW = 0.25;

/**
 * Patches a MeshStandardMaterial's shaders (use as `onBeforeCompile`) so the mesh's `_faceweight` attribute blends
 * the chrome (weight 0) into the photo skin in `map` (weight 1): colour, roughness, metalness and emission all
 * follow the weight, and the chrome's beat-driven emissive stays on the chrome.
 */
export function patchFaceSkin(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = patch(shader.vertexShader, "#include <common>", "attribute float _faceweight;\nvarying float vFaceWeight;");
  shader.vertexShader = patch(shader.vertexShader, "#include <uv_vertex>", "vFaceWeight = _faceweight;");
  shader.fragmentShader = patch(shader.fragmentShader, "#include <common>", "varying float vFaceWeight;");
  shader.fragmentShader = shader.fragmentShader.replace(
    anchor(shader.fragmentShader, "#include <map_fragment>"),
    [
      "vec3 faceSkin = diffuseColor.rgb;",
      "#ifdef USE_MAP",
      "  faceSkin = texture2D( map, vMapUv ).rgb;",
      "#endif",
      "diffuseColor.rgb = mix( diffuseColor.rgb, faceSkin, vFaceWeight );",
    ].join("\n")
  );
  shader.fragmentShader = patch(
    shader.fragmentShader,
    "#include <roughnessmap_fragment>",
    `roughnessFactor = mix( roughnessFactor, ${FACE_ROUGHNESS.toFixed(3)}, vFaceWeight );`
  );
  shader.fragmentShader = patch(
    shader.fragmentShader,
    "#include <metalnessmap_fragment>",
    "metalnessFactor = mix( metalnessFactor, 0.0, vFaceWeight );"
  );
  shader.fragmentShader = patch(
    shader.fragmentShader,
    "#include <emissivemap_fragment>",
    `totalEmissiveRadiance = mix( totalEmissiveRadiance, faceSkin * ${FACE_GLOW.toFixed(3)}, vFaceWeight );`
  );
}

/** Appends `code` after a shader chunk include. */
function patch(source: string, chunk: string, code: string) {
  return source.replace(anchor(source, chunk), `${chunk}\n${code}`);
}

function anchor(source: string, chunk: string) {
  if (!source.includes(chunk)) throw new Error(`the three.js shader has no ${chunk} to patch the face skin into`);
  return chunk;
}
