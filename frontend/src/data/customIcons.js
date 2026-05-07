import { createElement } from "react";
import CottonPadsSvg from "../assets/icons/custom/cottonPads.svg?react";
import DentalFlossSvg from "../assets/icons/custom/dentalFloss.svg?react";
import GarlicSvg from "../assets/icons/custom/garlic.svg?react";
import HummusSvg from "../assets/icons/custom/hummus.svg?react";
import KornflakesBowlSvg from "../assets/icons/custom/kornflakesBowl.svg?react";
import KornflakesBoxSvg from "../assets/icons/custom/kornflakesBox.svg?react";
import PastaSvg from "../assets/icons/custom/pasta.svg?react";
import ToothpasteSvg from "../assets/icons/custom/toothpaste.svg?react";

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

export const CustomCottonPads = normalizeCustomIcon(CottonPadsSvg, "CustomCottonPads");
export const CustomDentalFloss = normalizeCustomIcon(DentalFlossSvg, "CustomDentalFloss");
export const CustomGarlic = normalizeCustomIcon(GarlicSvg, "CustomGarlic");
export const CustomHummus = normalizeCustomIcon(HummusSvg, "CustomHummus");
export const CustomKornflakesBowl = normalizeCustomIcon(KornflakesBowlSvg, "CustomKornflakesBowl");
export const CustomKornflakesBox = normalizeCustomIcon(KornflakesBoxSvg, "CustomKornflakesBox");
export const CustomPasta = normalizeCustomIcon(PastaSvg, "CustomPasta");
export const CustomToothpaste = normalizeCustomIcon(ToothpasteSvg, "CustomToothpaste");
