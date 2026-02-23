/**
 * Outline filter using WebGPU (WGSL) + WebGL (GLSL) shaders.
 * Samples pixels in a ring around the current fragment; if a transparent
 * pixel has an opaque neighbour inside the ring it is coloured with the
 * outline colour, producing a crisp silhouette outline.
 *
 * Usage:
 *   sprite.filters = [HOVER_OUTLINE];   // add outline
 *   sprite.filters = null;              // remove outline
 */

// ── WGSL source (WebGPU) ─────────────────────────────────────────────

const OUTLINE_WGSL = /* wgsl */`
struct GlobalFilterUniforms {
    uInputSize:    vec4<f32>,
    uInputPixel:   vec4<f32>,
    uInputClamp:   vec4<f32>,
    uOutputFrame:  vec4<f32>,
    uGlobalFrame:  vec4<f32>,
    uOutputTexture:vec4<f32>,
};

struct OutlineUniforms {
    uOutline: vec4<f32>,   // xyz = colour,  w = thickness (px)
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> outlineUniforms: OutlineUniforms;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    return VSOutput(
        filterVertexPosition(aPosition),
        filterTextureCoord(aPosition),
    );
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color     = textureSample(uTexture, uSampler, uv);
    let thickness = outlineUniforms.uOutline.w;
    let outColor  = outlineUniforms.uOutline.xyz;

    // Sample all 16 neighbours unconditionally so every textureSample
    // call sits in uniform control flow (required by WGSL).
    let px = vec2<f32>(gfu.uInputPixel.z, gfu.uInputPixel.w);
    var maxAlpha: f32 = 0.0;

    let s0  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(0.0),                sin(0.0))                * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s1  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(0.392699081699),     sin(0.392699081699))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s2  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(0.785398163397),     sin(0.785398163397))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s3  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(1.178097245096),     sin(1.178097245096))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s4  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(1.570796326795),     sin(1.570796326795))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s5  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(1.963495408494),     sin(1.963495408494))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s6  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(2.356194490192),     sin(2.356194490192))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s7  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(2.748893571891),     sin(2.748893571891))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s8  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(3.14159265359),      sin(3.14159265359))      * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s9  = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(3.534291735289),     sin(3.534291735289))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s10 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(3.926990816987),     sin(3.926990816987))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s11 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(4.319689898686),     sin(4.319689898686))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s12 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(4.712388980385),     sin(4.712388980385))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s13 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(5.105088062083),     sin(5.105088062083))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s14 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(5.497787143782),     sin(5.497787143782))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));
    let s15 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(cos(5.890486225481),     sin(5.890486225481))     * thickness * px, gfu.uInputClamp.xy, gfu.uInputClamp.zw));

    maxAlpha = max(maxAlpha, max(max(max(s0.a, s1.a), max(s2.a, s3.a)),
                                 max(max(s4.a, s5.a), max(s6.a, s7.a))));
    maxAlpha = max(maxAlpha, max(max(max(s8.a, s9.a), max(s10.a, s11.a)),
                                 max(max(s12.a, s13.a), max(s14.a, s15.a))));

    // Opaque pixel → keep original; transparent with opaque neighbour → outline
    if (color.a > 0.5) {
        return color;
    }
    if (maxAlpha > 0.5) {
        return vec4<f32>(outColor, 1.0);
    }
    return color;
}
`;

// ── GLSL source (WebGL 2 fallback) ───────────────────────────────────

const OUTLINE_FRAG_GLSL = /* glsl */`
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform vec4 uOutline;   // xyz = colour,  w = thickness (px)

void main() {
    vec4 color     = texture(uTexture, vTextureCoord);
    float thickness = uOutline.w;
    vec3 outColor   = uOutline.xyz;

    if (color.a > 0.5) {
        finalColor = color;
        return;
    }

    vec2 px = uInputPixel.zw;
    float maxAlpha = 0.0;

    for (int i = 0; i < 16; i++) {
        float angle  = float(i) * (6.28318530718 / 16.0);
        vec2 offset  = vec2(cos(angle), sin(angle)) * thickness * px;
        vec2 sampleUV = clamp(vTextureCoord + offset, uInputClamp.xy, uInputClamp.zw);
        vec4 s       = texture(uTexture, sampleUV);
        maxAlpha     = max(maxAlpha, s.a);
    }

    if (maxAlpha > 0.5) {
        finalColor = vec4(outColor, 1.0);
        return;
    }

    finalColor = color;
}
`;

// ── Filter construction ──────────────────────────────────────────────

const OUTLINE_THICKNESS = 2;   // pixels
const OUTLINE_COLOR_R   = 1.0;
const OUTLINE_COLOR_G   = 1.0;
const OUTLINE_COLOR_B   = 1.0;

/**
 * Shared outline filter instance.  Applied to a sprite on hover,
 * removed on un-hover.
 */
const HOVER_OUTLINE = new PIXI.Filter({
    gpuProgram: PIXI.GpuProgram.from({
        vertex:   { source: OUTLINE_WGSL, entryPoint: 'mainVertex' },
        fragment: { source: OUTLINE_WGSL, entryPoint: 'mainFragment' },
        name: 'outline-filter',
    }),
    glProgram: PIXI.GlProgram.from({
        // Use the default PIXI filter vertex shader (ci) – already
        // loaded by pixi.min.js and available as PIXI.defaultFilterVert
        vertex:   PIXI.defaultFilterVert,
        fragment: OUTLINE_FRAG_GLSL,
        name: 'outline-filter',
    }),
    resources: {
        outlineUniforms: new PIXI.UniformGroup({
            uOutline: {
                value: new Float32Array([
                    OUTLINE_COLOR_R,
                    OUTLINE_COLOR_G,
                    OUTLINE_COLOR_B,
                    OUTLINE_THICKNESS,
                ]),
                type: 'vec4<f32>',
            },
        }),
    },
    padding: OUTLINE_THICKNESS + 1,
});
