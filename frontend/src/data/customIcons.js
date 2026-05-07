import { createElement } from "react";
import KornflakesBowlSvg from "../assets/icons/custom/kornflakesBowl.svg?react";
import KornflakesBoxSvg from "../assets/icons/custom/kornflakesBox.svg?react";

export function normalizeCustomIcon(SvgComponent, displayName) {
  function CustomIcon({ size = 24, stroke, strokeWidth, color = "currentColor", ...rest }) {
    return createElement(SvgComponent, {
      width: size,
      height: size,
      stroke: color,
      strokeWidth: stroke ?? strokeWidth ?? 1.5,
      ...rest
    });
  }

  CustomIcon.displayName = displayName;

  return CustomIcon;
}

export const CustomKornflakesBowl = normalizeCustomIcon(KornflakesBowlSvg, "CustomKornflakesBowl");
export const CustomKornflakesBox = normalizeCustomIcon(KornflakesBoxSvg, "CustomKornflakesBox");
