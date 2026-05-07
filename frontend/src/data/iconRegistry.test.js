import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { formatIconName, ICON_REGISTRY, ICON_REGISTRY_KEYS, resolveIconName } from "./iconRegistry";

afterEach(() => {
  cleanup();
});

describe("resolveIconName", () => {
  it("returns null for null and undefined values", () => {
    expect(resolveIconName(null)).toBeNull();
    expect(resolveIconName(undefined)).toBeNull();
  });

  it("returns known registry names unchanged", () => {
    expect(resolveIconName("IconMilk")).toBe("IconMilk");
  });

  it("includes the added grocery and household icons in selectable registry keys", () => {
    const addedIconNames = ["BicepsFlexed", "IconBean", "IconBeef", "IconCannabis", "IconGrape", "IconPaperBag"];

    for (const iconName of addedIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("includes the expanded tabler-backed icon candidates in selectable registry keys", () => {
    const expandedIconNames = ["IconFlame", "IconShoe", "IconSock"];

    for (const iconName of expandedIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("includes the custom Kornflakes icons in selectable registry keys", () => {
    const customIconNames = ["CustomKornflakesBowl", "CustomKornflakesBox"];

    for (const iconName of customIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("includes the added custom grocery and hygiene icons in selectable registry keys", () => {
    const customIconNames = [
      "CustomCottonPads",
      "CustomDentalFloss",
      "CustomGarlic",
      "CustomHummus",
      "CustomPasta",
      "CustomToothpaste"
    ];

    for (const iconName of customIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("includes the expanded custom icon set and package fallbacks in selectable registry keys", () => {
    const customIconNames = [
      "CustomBlueberries",
      "CustomCan",
      "CustomCottonSwabs",
      "CustomCreamJar",
      "CustomCreamTube",
      "CustomELiquid",
      "CustomInterdentalSticks",
      "CustomKiwi",
      "CustomMango",
      "CustomPants",
      "CustomPeach",
      "CustomPineapple",
      "CustomPlum",
      "CustomWatermelon",
      "CustomWetWipes"
    ];

    for (const iconName of customIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("returns null for unknown names without aliases", () => {
    expect(resolveIconName("IconDoesNotExist")).toBeNull();
  });

  it("documents that alias coverage must be added when a real alias ships", () => {
    // ICON_ALIASES is frozen in production. When a real alias is introduced,
    // add a dedicated test for that shipped entry instead of mutating the map here.
    expect(resolveIconName("FutureAliasPlaceholder")).toBeNull();
  });
});

describe("formatIconName", () => {
  it("formats registry names for display", () => {
    expect(formatIconName("IconMilk")).toBe("Milk");
    expect(formatIconName("IconIceCream2")).toBe("Ice Cream 2");
    expect(formatIconName("IconFlame")).toBe("Flame");
    expect(formatIconName("IconShoe")).toBe("Shoe");
    expect(formatIconName("IconSock")).toBe("Sock");
    expect(formatIconName("CakeSlice")).toBe("Cake Slice");
    expect(formatIconName("ForkKnife")).toBe("Fork Knife");
    expect(formatIconName("Banana")).toBe("Banana");
    expect(formatIconName("CustomBlueberries")).toBe("Blueberries");
    expect(formatIconName("CustomCan")).toBe("Can");
    expect(formatIconName("IconBowlChopsticks")).toBe("Bowl Chopsticks");
    expect(formatIconName("CustomCottonPads")).toBe("Cotton Pads");
    expect(formatIconName("CustomCottonSwabs")).toBe("Cotton Swabs");
    expect(formatIconName("CustomCreamJar")).toBe("Cream Jar");
    expect(formatIconName("CustomCreamTube")).toBe("Cream Tube");
    expect(formatIconName("CustomDentalFloss")).toBe("Dental Floss");
    expect(formatIconName("CustomELiquid")).toBe("E Liquid");
    expect(formatIconName("CustomGarlic")).toBe("Garlic");
    expect(formatIconName("CustomHummus")).toBe("Hummus");
    expect(formatIconName("CustomInterdentalSticks")).toBe("Interdental Sticks");
    expect(formatIconName("CustomKiwi")).toBe("Kiwi");
    expect(formatIconName("CustomKornflakesBowl")).toBe("Kornflakes Bowl");
    expect(formatIconName("CustomKornflakesBox")).toBe("Kornflakes Box");
    expect(formatIconName("CustomMango")).toBe("Mango");
    expect(formatIconName("CustomPasta")).toBe("Pasta");
    expect(formatIconName("CustomPants")).toBe("Pants");
    expect(formatIconName("CustomPeach")).toBe("Peach");
    expect(formatIconName("CustomPineapple")).toBe("Pineapple");
    expect(formatIconName("CustomPlum")).toBe("Plum");
    expect(formatIconName("CustomToothpaste")).toBe("Toothpaste");
    expect(formatIconName("CustomWatermelon")).toBe("Watermelon");
    expect(formatIconName("CustomWetWipes")).toBe("Wet Wipes");
  });
});

describe("custom icons", () => {
  it.each([
    ["CustomBlueberries", 22],
    ["CustomBlueberries", 32],
    ["CustomCan", 22],
    ["CustomCan", 32],
    ["CustomCottonPads", 22],
    ["CustomCottonPads", 32],
    ["CustomCottonSwabs", 22],
    ["CustomCottonSwabs", 32],
    ["CustomCreamJar", 22],
    ["CustomCreamJar", 32],
    ["CustomCreamTube", 22],
    ["CustomCreamTube", 32],
    ["CustomDentalFloss", 22],
    ["CustomDentalFloss", 32],
    ["CustomELiquid", 22],
    ["CustomELiquid", 32],
    ["CustomGarlic", 22],
    ["CustomGarlic", 32],
    ["CustomHummus", 22],
    ["CustomHummus", 32],
    ["CustomInterdentalSticks", 22],
    ["CustomInterdentalSticks", 32],
    ["CustomKiwi", 22],
    ["CustomKiwi", 32],
    ["CustomKornflakesBowl", 22],
    ["CustomKornflakesBowl", 32],
    ["CustomKornflakesBox", 22],
    ["CustomKornflakesBox", 32],
    ["CustomMango", 22],
    ["CustomMango", 32],
    ["CustomPasta", 22],
    ["CustomPasta", 32],
    ["CustomPants", 22],
    ["CustomPants", 32],
    ["CustomPeach", 22],
    ["CustomPeach", 32],
    ["CustomPineapple", 22],
    ["CustomPineapple", 32],
    ["CustomPlum", 22],
    ["CustomPlum", 32],
    ["CustomToothpaste", 22],
    ["CustomToothpaste", 32],
    ["CustomWatermelon", 22],
    ["CustomWatermelon", 32],
    ["CustomWetWipes", 22],
    ["CustomWetWipes", 32]
  ])("renders %s at the requested size with currentColor stroke", (iconName, size) => {
    const CustomIcon = ICON_REGISTRY[iconName];

    render(createElement(CustomIcon, { "aria-label": iconName, size }));

    const icon = screen.getByLabelText(iconName);

    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("width")).toBe(String(size));
    expect(icon.getAttribute("height")).toBe(String(size));
    expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon.getAttribute("stroke")).toBe("currentColor");
    expect(icon.getAttribute("fill")).toBe("none");
  });
});
