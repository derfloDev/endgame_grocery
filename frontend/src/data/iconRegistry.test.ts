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

  it("includes the food and produce icon set in selectable registry keys", () => {
    const foodIconNames = [
      "CustomBellPepper",
      "CustomBreadRoll",
      "CustomButter",
      "CustomChips",
      "CustomChocolate",
      "CustomCream",
      "CustomCucumber",
      "CustomFries",
      "CustomFrozenBerries",
      "CustomFrozenVegetables",
      "CustomJam",
      "CustomOnion",
      "CustomPastaSauce",
      "CustomPotato",
      "CustomQuark",
      "CustomRice",
      "CustomTomato",
      "CustomYogurt",
      "IconBaguette"
    ];

    for (const iconName of foodIconNames) {
      expect(ICON_REGISTRY[iconName]).toBeTruthy();
      expect(ICON_REGISTRY_KEYS).toContain(iconName);
      expect(resolveIconName(iconName)).toBe(iconName);
    }
  });

  it("includes the drugstore and household icon set in selectable registry keys", () => {
    const drugstoreIconNames = [
      "CustomAfterSun",
      "CustomBakingPaper",
      "CustomBodyWash",
      "CustomCleaningCloth",
      "CustomConditioner",
      "CustomDetergent",
      "CustomDiapers",
      "CustomFabricSoftener",
      "CustomFoil",
      "CustomGlassesCleaner",
      "CustomHandSoap",
      "CustomMop",
      "CustomMouthwash",
      "CustomPaperTowels",
      "CustomShampoo",
      "CustomShavingCream",
      "CustomSponge",
      "CustomStorageBags",
      "CustomSunscreen",
      "CustomToothbrush"
    ];

    for (const iconName of drugstoreIconNames) {
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
    expect(formatIconName("CustomAfterSun")).toBe("After Sun");
    expect(formatIconName("CustomBakingPaper")).toBe("Baking Paper");
    expect(formatIconName("CustomBlueberries")).toBe("Blueberries");
    expect(formatIconName("CustomBodyWash")).toBe("Body Wash");
    expect(formatIconName("CustomBellPepper")).toBe("Bell Pepper");
    expect(formatIconName("IconBaguette")).toBe("Baguette");
    expect(formatIconName("CustomBreadRoll")).toBe("Bread Roll");
    expect(formatIconName("CustomButter")).toBe("Butter");
    expect(formatIconName("CustomChips")).toBe("Chips");
    expect(formatIconName("CustomChocolate")).toBe("Chocolate");
    expect(formatIconName("CustomCleaningCloth")).toBe("Cleaning Cloth");
    expect(formatIconName("CustomConditioner")).toBe("Conditioner");
    expect(formatIconName("CustomCream")).toBe("Cream");
    expect(formatIconName("CustomCan")).toBe("Can");
    expect(formatIconName("IconBowlChopsticks")).toBe("Bowl Chopsticks");
    expect(formatIconName("CustomCottonPads")).toBe("Cotton Pads");
    expect(formatIconName("CustomCottonSwabs")).toBe("Cotton Swabs");
    expect(formatIconName("CustomCucumber")).toBe("Cucumber");
    expect(formatIconName("CustomCreamJar")).toBe("Cream Jar");
    expect(formatIconName("CustomCreamTube")).toBe("Cream Tube");
    expect(formatIconName("CustomDentalFloss")).toBe("Dental Floss");
    expect(formatIconName("CustomDetergent")).toBe("Detergent");
    expect(formatIconName("CustomDiapers")).toBe("Diapers");
    expect(formatIconName("CustomELiquid")).toBe("E Liquid");
    expect(formatIconName("CustomFabricSoftener")).toBe("Fabric Softener");
    expect(formatIconName("CustomFoil")).toBe("Foil");
    expect(formatIconName("CustomFries")).toBe("Fries");
    expect(formatIconName("CustomFrozenBerries")).toBe("Frozen Berries");
    expect(formatIconName("CustomFrozenVegetables")).toBe("Frozen Vegetables");
    expect(formatIconName("CustomGarlic")).toBe("Garlic");
    expect(formatIconName("CustomGlassesCleaner")).toBe("Glasses Cleaner");
    expect(formatIconName("CustomHandSoap")).toBe("Hand Soap");
    expect(formatIconName("CustomHummus")).toBe("Hummus");
    expect(formatIconName("CustomInterdentalSticks")).toBe("Interdental Sticks");
    expect(formatIconName("CustomJam")).toBe("Jam");
    expect(formatIconName("CustomKiwi")).toBe("Kiwi");
    expect(formatIconName("CustomKornflakesBowl")).toBe("Kornflakes Bowl");
    expect(formatIconName("CustomKornflakesBox")).toBe("Kornflakes Box");
    expect(formatIconName("CustomMango")).toBe("Mango");
    expect(formatIconName("CustomMop")).toBe("Mop");
    expect(formatIconName("CustomMouthwash")).toBe("Mouthwash");
    expect(formatIconName("CustomOnion")).toBe("Onion");
    expect(formatIconName("CustomPaperTowels")).toBe("Paper Towels");
    expect(formatIconName("CustomPasta")).toBe("Pasta");
    expect(formatIconName("CustomPastaSauce")).toBe("Pasta Sauce");
    expect(formatIconName("CustomPants")).toBe("Pants");
    expect(formatIconName("CustomPeach")).toBe("Peach");
    expect(formatIconName("CustomPineapple")).toBe("Pineapple");
    expect(formatIconName("CustomPlum")).toBe("Plum");
    expect(formatIconName("CustomPotato")).toBe("Potato");
    expect(formatIconName("CustomQuark")).toBe("Quark");
    expect(formatIconName("CustomRice")).toBe("Rice");
    expect(formatIconName("CustomShampoo")).toBe("Shampoo");
    expect(formatIconName("CustomShavingCream")).toBe("Shaving Cream");
    expect(formatIconName("CustomSponge")).toBe("Sponge");
    expect(formatIconName("CustomStorageBags")).toBe("Storage Bags");
    expect(formatIconName("CustomSunscreen")).toBe("Sunscreen");
    expect(formatIconName("CustomTomato")).toBe("Tomato");
    expect(formatIconName("CustomToothpaste")).toBe("Toothpaste");
    expect(formatIconName("CustomToothbrush")).toBe("Toothbrush");
    expect(formatIconName("CustomWatermelon")).toBe("Watermelon");
    expect(formatIconName("CustomWetWipes")).toBe("Wet Wipes");
    expect(formatIconName("CustomYogurt")).toBe("Yogurt");
  });
});

describe("custom icons", () => {
  it.each([
    ["CustomAfterSun", 22],
    ["CustomAfterSun", 32],
    ["CustomBakingPaper", 22],
    ["CustomBakingPaper", 32],
    ["CustomBellPepper", 22],
    ["CustomBellPepper", 32],
    ["CustomBlueberries", 22],
    ["CustomBlueberries", 32],
    ["CustomBodyWash", 22],
    ["CustomBodyWash", 32],
    ["CustomBreadRoll", 22],
    ["CustomBreadRoll", 32],
    ["CustomButter", 22],
    ["CustomButter", 32],
    ["CustomCan", 22],
    ["CustomCan", 32],
    ["CustomChips", 22],
    ["CustomChips", 32],
    ["CustomChocolate", 22],
    ["CustomChocolate", 32],
    ["CustomCleaningCloth", 22],
    ["CustomCleaningCloth", 32],
    ["CustomConditioner", 22],
    ["CustomConditioner", 32],
    ["CustomCottonPads", 22],
    ["CustomCottonPads", 32],
    ["CustomCottonSwabs", 22],
    ["CustomCottonSwabs", 32],
    ["CustomCream", 22],
    ["CustomCream", 32],
    ["CustomCreamJar", 22],
    ["CustomCreamJar", 32],
    ["CustomCreamTube", 22],
    ["CustomCreamTube", 32],
    ["CustomCucumber", 22],
    ["CustomCucumber", 32],
    ["CustomDentalFloss", 22],
    ["CustomDentalFloss", 32],
    ["CustomDetergent", 22],
    ["CustomDetergent", 32],
    ["CustomDiapers", 22],
    ["CustomDiapers", 32],
    ["CustomELiquid", 22],
    ["CustomELiquid", 32],
    ["CustomFabricSoftener", 22],
    ["CustomFabricSoftener", 32],
    ["CustomFoil", 22],
    ["CustomFoil", 32],
    ["CustomFries", 22],
    ["CustomFries", 32],
    ["CustomFrozenBerries", 22],
    ["CustomFrozenBerries", 32],
    ["CustomFrozenVegetables", 22],
    ["CustomFrozenVegetables", 32],
    ["CustomGarlic", 22],
    ["CustomGarlic", 32],
    ["CustomGlassesCleaner", 22],
    ["CustomGlassesCleaner", 32],
    ["CustomHandSoap", 22],
    ["CustomHandSoap", 32],
    ["CustomHummus", 22],
    ["CustomHummus", 32],
    ["CustomInterdentalSticks", 22],
    ["CustomInterdentalSticks", 32],
    ["CustomJam", 22],
    ["CustomJam", 32],
    ["CustomKiwi", 22],
    ["CustomKiwi", 32],
    ["CustomKornflakesBowl", 22],
    ["CustomKornflakesBowl", 32],
    ["CustomKornflakesBox", 22],
    ["CustomKornflakesBox", 32],
    ["CustomMango", 22],
    ["CustomMango", 32],
    ["CustomMop", 22],
    ["CustomMop", 32],
    ["CustomMouthwash", 22],
    ["CustomMouthwash", 32],
    ["CustomOnion", 22],
    ["CustomOnion", 32],
    ["CustomPasta", 22],
    ["CustomPasta", 32],
    ["CustomPastaSauce", 22],
    ["CustomPastaSauce", 32],
    ["CustomPants", 22],
    ["CustomPants", 32],
    ["CustomPaperTowels", 22],
    ["CustomPaperTowels", 32],
    ["CustomPeach", 22],
    ["CustomPeach", 32],
    ["CustomPineapple", 22],
    ["CustomPineapple", 32],
    ["CustomPlum", 22],
    ["CustomPlum", 32],
    ["CustomPotato", 22],
    ["CustomPotato", 32],
    ["CustomQuark", 22],
    ["CustomQuark", 32],
    ["CustomRice", 22],
    ["CustomRice", 32],
    ["CustomShampoo", 22],
    ["CustomShampoo", 32],
    ["CustomShavingCream", 22],
    ["CustomShavingCream", 32],
    ["CustomSponge", 22],
    ["CustomSponge", 32],
    ["CustomStorageBags", 22],
    ["CustomStorageBags", 32],
    ["CustomSunscreen", 22],
    ["CustomSunscreen", 32],
    ["CustomTomato", 22],
    ["CustomTomato", 32],
    ["CustomToothpaste", 22],
    ["CustomToothpaste", 32],
    ["CustomToothbrush", 22],
    ["CustomToothbrush", 32],
    ["CustomWatermelon", 22],
    ["CustomWatermelon", 32],
    ["CustomWetWipes", 22],
    ["CustomWetWipes", 32],
    ["CustomYogurt", 22],
    ["CustomYogurt", 32]
  ])("renders %s at the requested size with currentColor stroke", (iconName, size) => {
    const CustomIcon = ICON_REGISTRY[iconName];

    render(createElement(CustomIcon, { "data-testid": iconName, size }));

    const icon = screen.getByTestId(iconName);

    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("width")).toBe(String(size));
    expect(icon.getAttribute("height")).toBe(String(size));
    expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon.getAttribute("stroke")).toBe("currentColor");
    expect(icon.getAttribute("fill")).toBe("none");
  });
});
