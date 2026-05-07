import { createElement } from "react";

export function fromCustomSVG({ displayName, viewBox = "0 0 24 24", elements }) {
  function CustomIcon({ size = 24, stroke, strokeWidth, color = "currentColor", ...rest }) {
    return createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox,
        fill: "none",
        stroke: color,
        strokeWidth: stroke ?? strokeWidth ?? 1.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...rest
      },
      ...elements
    );
  }

  CustomIcon.displayName = displayName;

  return CustomIcon;
}

export const CustomKornflakesBowl = fromCustomSVG({
  displayName: "CustomKornflakesBowl",
  elements: [
    createElement("path", { key: "rim", d: "M5 14.5c.8 3.1 3.1 5 7 5s6.2-1.9 7-5" }),
    createElement("path", { key: "bowl", d: "M4.5 14.5h15" }),
    createElement("path", { key: "base", d: "M9 20.5h6" }),
    createElement("path", { key: "flake-1", d: "M7.2 7.3l2.1-.8 1.2 1.5-.8 1.7-2.1.3-1.1-1.2z" }),
    createElement("path", { key: "flake-2", d: "M13.2 5.4l1.8.6.3 1.8-1.5 1.1-1.7-.7-.2-1.8z" }),
    createElement("path", { key: "flake-3", d: "M16.7 10l1.6-.4 1.1 1.2-.6 1.5-1.6.4-1-1.1z" }),
    createElement("path", { key: "flake-4", d: "M10.7 10.6l1.4-.5 1 .9-.4 1.4-1.4.5-1-.9z" })
  ]
});

export const CustomKornflakesBox = fromCustomSVG({
  displayName: "CustomKornflakesBox",
  elements: [
    createElement("path", { key: "body", d: "M7 5.5h10v15H7z" }),
    createElement("path", { key: "top", d: "M7 5.5l2-2h6l2 2" }),
    createElement("path", { key: "side", d: "M9 3.5v2" }),
    createElement("path", { key: "label-top", d: "M9.5 9h5" }),
    createElement("path", { key: "label-bottom", d: "M9.5 12h5" }),
    createElement("path", { key: "grain", d: "M10 16.5c1.2-1.2 2.8-1.2 4 0" })
  ]
});
