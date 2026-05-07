import { createElement } from "react";
import BellPepperSvg from "../assets/icons/custom/bellPepper.svg?react";
import BlueberriesSvg from "../assets/icons/custom/blueberries.svg?react";
import BreadRollSvg from "../assets/icons/custom/breadRoll.svg?react";
import ButterSvg from "../assets/icons/custom/butter.svg?react";
import CanSvg from "../assets/icons/custom/can.svg?react";
import ChipsSvg from "../assets/icons/custom/chips.svg?react";
import ChocolateSvg from "../assets/icons/custom/chocolate.svg?react";
import CottonPadsSvg from "../assets/icons/custom/cottonPads.svg?react";
import CottonSwabsSvg from "../assets/icons/custom/cottonSwabs.svg?react";
import CreamSvg from "../assets/icons/custom/cream.svg?react";
import CreamJarSvg from "../assets/icons/custom/creamJar.svg?react";
import CreamTubeSvg from "../assets/icons/custom/creamTube.svg?react";
import CucumberSvg from "../assets/icons/custom/cucumber.svg?react";
import DentalFlossSvg from "../assets/icons/custom/dentalFloss.svg?react";
import ELiquidSvg from "../assets/icons/custom/eLiquid.svg?react";
import FriesSvg from "../assets/icons/custom/fries.svg?react";
import FrozenBerriesSvg from "../assets/icons/custom/frozenBerries.svg?react";
import FrozenVegetablesSvg from "../assets/icons/custom/frozenVegetables.svg?react";
import GarlicSvg from "../assets/icons/custom/garlic.svg?react";
import HummusSvg from "../assets/icons/custom/hummus.svg?react";
import InterdentalSticksSvg from "../assets/icons/custom/interdentalSticks.svg?react";
import JamSvg from "../assets/icons/custom/jam.svg?react";
import KiwiSvg from "../assets/icons/custom/kiwi.svg?react";
import KornflakesBowlSvg from "../assets/icons/custom/kornflakesBowl.svg?react";
import KornflakesBoxSvg from "../assets/icons/custom/kornflakesBox.svg?react";
import MangoSvg from "../assets/icons/custom/mango.svg?react";
import OnionSvg from "../assets/icons/custom/onion.svg?react";
import PastaSvg from "../assets/icons/custom/pasta.svg?react";
import PastaSauceSvg from "../assets/icons/custom/pastaSauce.svg?react";
import PantsSvg from "../assets/icons/custom/pants.svg?react";
import PeachSvg from "../assets/icons/custom/peach.svg?react";
import PineappleSvg from "../assets/icons/custom/pineapple.svg?react";
import PlumSvg from "../assets/icons/custom/plum.svg?react";
import PotatoSvg from "../assets/icons/custom/potato.svg?react";
import QuarkSvg from "../assets/icons/custom/quark.svg?react";
import RiceSvg from "../assets/icons/custom/rice.svg?react";
import TomatoSvg from "../assets/icons/custom/tomato.svg?react";
import ToothpasteSvg from "../assets/icons/custom/toothpaste.svg?react";
import WatermelonSvg from "../assets/icons/custom/watermelon.svg?react";
import WetWipesSvg from "../assets/icons/custom/wetWipes.svg?react";
import YogurtSvg from "../assets/icons/custom/yogurt.svg?react";

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

export const CustomBellPepper = normalizeCustomIcon(BellPepperSvg, "CustomBellPepper");
export const CustomBlueberries = normalizeCustomIcon(BlueberriesSvg, "CustomBlueberries");
export const CustomBreadRoll = normalizeCustomIcon(BreadRollSvg, "CustomBreadRoll");
export const CustomButter = normalizeCustomIcon(ButterSvg, "CustomButter");
export const CustomCan = normalizeCustomIcon(CanSvg, "CustomCan");
export const CustomChips = normalizeCustomIcon(ChipsSvg, "CustomChips");
export const CustomChocolate = normalizeCustomIcon(ChocolateSvg, "CustomChocolate");
export const CustomCottonPads = normalizeCustomIcon(CottonPadsSvg, "CustomCottonPads");
export const CustomCottonSwabs = normalizeCustomIcon(CottonSwabsSvg, "CustomCottonSwabs");
export const CustomCream = normalizeCustomIcon(CreamSvg, "CustomCream");
export const CustomCreamJar = normalizeCustomIcon(CreamJarSvg, "CustomCreamJar");
export const CustomCreamTube = normalizeCustomIcon(CreamTubeSvg, "CustomCreamTube");
export const CustomCucumber = normalizeCustomIcon(CucumberSvg, "CustomCucumber");
export const CustomDentalFloss = normalizeCustomIcon(DentalFlossSvg, "CustomDentalFloss");
export const CustomELiquid = normalizeCustomIcon(ELiquidSvg, "CustomELiquid");
export const CustomFries = normalizeCustomIcon(FriesSvg, "CustomFries");
export const CustomFrozenBerries = normalizeCustomIcon(FrozenBerriesSvg, "CustomFrozenBerries");
export const CustomFrozenVegetables = normalizeCustomIcon(FrozenVegetablesSvg, "CustomFrozenVegetables");
export const CustomGarlic = normalizeCustomIcon(GarlicSvg, "CustomGarlic");
export const CustomHummus = normalizeCustomIcon(HummusSvg, "CustomHummus");
export const CustomInterdentalSticks = normalizeCustomIcon(InterdentalSticksSvg, "CustomInterdentalSticks");
export const CustomJam = normalizeCustomIcon(JamSvg, "CustomJam");
export const CustomKiwi = normalizeCustomIcon(KiwiSvg, "CustomKiwi");
export const CustomKornflakesBowl = normalizeCustomIcon(KornflakesBowlSvg, "CustomKornflakesBowl");
export const CustomKornflakesBox = normalizeCustomIcon(KornflakesBoxSvg, "CustomKornflakesBox");
export const CustomMango = normalizeCustomIcon(MangoSvg, "CustomMango");
export const CustomOnion = normalizeCustomIcon(OnionSvg, "CustomOnion");
export const CustomPasta = normalizeCustomIcon(PastaSvg, "CustomPasta");
export const CustomPastaSauce = normalizeCustomIcon(PastaSauceSvg, "CustomPastaSauce");
export const CustomPants = normalizeCustomIcon(PantsSvg, "CustomPants");
export const CustomPeach = normalizeCustomIcon(PeachSvg, "CustomPeach");
export const CustomPineapple = normalizeCustomIcon(PineappleSvg, "CustomPineapple");
export const CustomPlum = normalizeCustomIcon(PlumSvg, "CustomPlum");
export const CustomPotato = normalizeCustomIcon(PotatoSvg, "CustomPotato");
export const CustomQuark = normalizeCustomIcon(QuarkSvg, "CustomQuark");
export const CustomRice = normalizeCustomIcon(RiceSvg, "CustomRice");
export const CustomTomato = normalizeCustomIcon(TomatoSvg, "CustomTomato");
export const CustomToothpaste = normalizeCustomIcon(ToothpasteSvg, "CustomToothpaste");
export const CustomWatermelon = normalizeCustomIcon(WatermelonSvg, "CustomWatermelon");
export const CustomWetWipes = normalizeCustomIcon(WetWipesSvg, "CustomWetWipes");
export const CustomYogurt = normalizeCustomIcon(YogurtSvg, "CustomYogurt");
