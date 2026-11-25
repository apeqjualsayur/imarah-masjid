import { describe, expect, it } from "vitest";
import { SEED_LOGO_SVG } from "../../scripts/seed-data";
import { checkLogo, initials, LOGO_MAX_BYTES } from "@/lib/logo";

const text = (value: string) => new TextEncoder().encode(value);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const svg = (inner: string) => text(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`);

describe("checking a logo file", () => {
  it("accepts a PNG by its bytes", () => {
    expect(checkLogo(PNG)).toEqual({ ok: true, ext: "png", contentType: "image/png" });
  });

  it("accepts a plain SVG, with or without an XML line", () => {
    expect(checkLogo(svg('<circle r="5"/>'))).toMatchObject({ ok: true, ext: "svg" });
    expect(checkLogo(text(`<?xml version="1.0"?>\n${new TextDecoder().decode(svg("<rect/>"))}`))).toMatchObject({
      ok: true,
    });
    expect(checkLogo(text(SEED_LOGO_SVG))).toMatchObject({ ok: true, ext: "svg" });
  });

  it("refuses an empty or too-big file", () => {
    expect(checkLogo(new Uint8Array())).toEqual({ ok: false, error: "logo_empty" });
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(PNG);
    expect(checkLogo(big)).toEqual({ ok: false, error: "logo_too_big" });
  });

  it("refuses other types, whatever the name says", () => {
    expect(checkLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: false, error: "logo_wrong_type" });
    expect(checkLogo(text("<html><body>hi</body></html>"))).toEqual({ ok: false, error: "logo_wrong_type" });
    expect(checkLogo(text("%PDF-1.7"))).toEqual({ ok: false, error: "logo_wrong_type" });
  });

  it.each([
    ["a script", "<script>alert(1)</script>"],
    ["an event handler", '<circle r="5" onload="alert(1)"/>'],
    ["a javascript link", '<a href="javascript:alert(1)"><rect/></a>'],
    ["embedded HTML", "<foreignObject><div/></foreignObject>"],
    ["an outside image", '<image href="https://jahat.example/x.png"/>'],
    ["a CSS import", "<style>@import url(x.css);</style>"],
  ])("refuses an SVG with %s", (_, inner) => {
    expect(checkLogo(svg(inner))).toEqual({ ok: false, error: "logo_unsafe_svg" });
  });
});

describe("initials", () => {
  it.each([
    ["Surau Baru", "SB"],
    ["Masjid Al-Hidayah", "MA"],
    ["masjid", "M"],
    ["  ", "?"],
    ["Ahmad bin Ali", "AB"],
  ])("%s -> %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
