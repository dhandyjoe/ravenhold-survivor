import { LIGHTING } from '../config';

/**
 * Tanah: satu quad layar penuh dengan koordinat dunia. Semua detail berasal dari sampling
 * tekstur (bukan noise prosedural berat) supaya tetap ringan di HP kelas menengah.
 * Tile dipakai pada dua skala dan dicampur noise besar, sehingga polanya tidak terlihat berulang.
 */
export const GROUND_FRAG = `
#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

#define LIGHTS ${LIGHTING.maxLights}

uniform sampler2D uGrass;
uniform sampler2D uDirt;
uniform sampler2D uStone;
uniform sampler2D uNoise;
uniform vec2 uCam;
uniform vec2 uView;
uniform float uTime;
uniform vec3 uAmbient;
uniform vec3 uSun;
uniform float uCloud;
uniform vec3 uLightPos[LIGHTS]; // x, y, radius
uniform vec3 uLightColor[LIGHTS];

varying vec2 outTexCoord;

void main ()
{
    // outTexCoord memakai konvensi GL (y=1 di atas), dunia memakai y ke bawah.
    vec2 w = uCam + vec2(outTexCoord.x - 0.5, 0.5 - outTexCoord.y) * uView;

    vec3 macro = texture2D(uNoise, w / 2300.0).rgb;
    vec3 fine = texture2D(uNoise, w / 640.0).rgb;

    vec2 p = w / 256.0;
    vec3 grassA = texture2D(uGrass, p).rgb;
    vec3 grassB = texture2D(uGrass, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.71 + 0.37).rgb;
    vec3 col = mix(grassA, grassB, smoothstep(0.38, 0.62, fine.r));

    // Pola besar: padang berganti antara hijau sejuk dan kuning hangat
    col *= mix(vec3(0.82, 0.92, 0.8), vec3(1.14, 1.08, 0.84), smoothstep(0.25, 0.75, macro.r));

    // Jalan setapak mengikuti garis kontur noise, jadi berkelok alami tanpa data tambahan
    float pv = abs(macro.g + (fine.g - 0.5) * 0.07 - 0.5);
    float path = 1.0 - smoothstep(0.014, 0.03, pv);
    if (path > 0.0) col = mix(col, texture2D(uDirt, p * 1.3).rgb, path);

    // Sisa lantai batu kuno di puncak noise, tepinya dimakan rumput
    float ruin = smoothstep(0.72, 0.74, macro.b + (fine.b - 0.5) * 0.1);
    if (ruin > 0.0) col = mix(col, texture2D(uStone, p).rgb, ruin);

    // Hembusan angin: pita terang yang menyapu rumput
    float gust = texture2D(uNoise, w / 980.0 + uTime * vec2(0.014, 0.006)).g;
    col *= 1.0 + smoothstep(0.55, 0.85, gust) * 0.12 * (1.0 - ruin) * (1.0 - path);

    // Bayangan awan yang bergerak
    float cloud = texture2D(uNoise, w / 1900.0 - uTime * vec2(0.007, 0.004)).r;
    float shade = 1.0 - uCloud * smoothstep(0.46, 0.62, cloud);

    // Titik cahaya: posisi dan warnanya sama dengan lampu sprite Phaser
    vec3 light = uAmbient + uSun * shade;
    for (int i = 0; i < LIGHTS; i++)
    {
        vec2 d = w - uLightPos[i].xy;
        float r = uLightPos[i].z;
        float a = clamp(1.0 - dot(d, d) / (r * r), 0.0, 1.0);
        // Dikuadratkan agar tepi cahaya memudar lembut, bukan seperti lampu sorot
        light += uLightColor[i] * a * a;
    }

    gl_FragColor = vec4(col * light, 1.0);
}
`;
