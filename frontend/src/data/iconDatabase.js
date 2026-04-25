function toLookupKey(term) {
  return term.trim().toLowerCase();
}

function createExactMatchMap(entries) {
  return Object.freeze(
    entries.reduce((map, { label, icon, tags = [] }) => {
      for (const term of [label, ...tags]) {
        const key = toLookupKey(term);

        if (key) {
          map[key] = icon;
        }
      }

      return map;
    }, {})
  );
}

export const ICON_DB = [
  // Dairy
  { label: "milk", icon: "🥛", tags: ["milch", "whole milk", "vollmilch", "oat milk", "hafermilch"] },
  { label: "cheese", icon: "🧀", tags: ["käse", "kaese", "gouda", "cheddar", "mozzarella"] },
  { label: "butter", icon: "🧈", tags: ["butter"] },
  { label: "yogurt", icon: "🥣", tags: ["yoghurt", "joghurt"] },
  { label: "eggs", icon: "🥚", tags: ["egg", "ei", "eier"] },
  { label: "cream", icon: "🥛", tags: ["sahne", "whipping cream", "schlagsahne"] },
  { label: "quark", icon: "🧀", tags: ["quark", "curd cheese", "speisequark"] },
  { label: "cottage cheese", icon: "🧀", tags: ["hüttenkäse", "huettenkaese", "körniger frischkäse"] },

  // Produce
  { label: "apple", icon: "🍎", tags: ["apfel", "apples", "äpfel", "aepfel"] },
  { label: "banana", icon: "🍌", tags: ["banane", "bananas", "bananen"] },
  { label: "tomato", icon: "🍅", tags: ["tomate", "tomatoes", "tomaten"] },
  { label: "carrot", icon: "🥕", tags: ["karotte", "karotten", "möhre", "moehre", "möhren", "moehren"] },
  { label: "cucumber", icon: "🥒", tags: ["gurke", "gurken"] },
  { label: "lettuce", icon: "🥬", tags: ["salat", "kopfsalat", "romaine"] },
  { label: "bell pepper", icon: "🫑", tags: ["paprika", "paprikaschote"] },
  { label: "potato", icon: "🥔", tags: ["kartoffel", "kartoffeln", "potatoes"] },
  { label: "onion", icon: "🧅", tags: ["zwiebel", "zwiebeln"] },
  { label: "garlic", icon: "🧄", tags: ["knoblauch"] },
  { label: "lemon", icon: "🍋", tags: ["zitrone", "zitronen"] },
  { label: "grapes", icon: "🍇", tags: ["trauben", "weintrauben"] },
  { label: "strawberry", icon: "🍓", tags: ["erdbeere", "erdbeeren", "strawberries"] },
  { label: "mushroom", icon: "🍄", tags: ["pilz", "pilze", "champignon", "champignons"] },
  { label: "avocado", icon: "🥑", tags: ["avocado", "avocados"] },
  { label: "broccoli", icon: "🥦", tags: ["brokkoli"] },
  { label: "corn", icon: "🌽", tags: ["mais"] },
  { label: "spinach", icon: "🥬", tags: ["spinat"] },

  // Bakery
  { label: "bread", icon: "🍞", tags: ["brot", "toast"] },
  { label: "bread roll", icon: "🥖", tags: ["bread rolls", "brötchen", "broetchen", "roll"] },
  { label: "baguette", icon: "🥖", tags: ["baguette"] },
  { label: "croissant", icon: "🥐", tags: ["croissant"] },
  { label: "pretzel", icon: "🥨", tags: ["brezel", "pretzels"] },
  { label: "cake", icon: "🍰", tags: ["kuchen"] },
  { label: "flour", icon: "🌾", tags: ["mehl"] },

  // Meat and fish
  { label: "chicken", icon: "🍗", tags: ["hähnchen", "haehnchen", "huhn"] },
  { label: "beef", icon: "🥩", tags: ["rind", "rindfleisch"] },
  { label: "bacon", icon: "🥓", tags: ["speck"] },
  { label: "sausage", icon: "🌭", tags: ["wurst", "würstchen", "wuerstchen"] },
  { label: "ham", icon: "🥓", tags: ["schinken"] },
  { label: "fish", icon: "🐟", tags: ["fisch", "lachs", "salmon"] },
  { label: "shrimp", icon: "🍤", tags: ["garnele", "garnelen", "prawn", "prawns"] },
  { label: "turkey", icon: "🦃", tags: ["pute", "putenfleisch", "truthahn"] },

  // Beverages
  { label: "water", icon: "💧", tags: ["wasser", "still water", "stilles wasser"] },
  { label: "juice", icon: "🧃", tags: ["saft", "orange juice", "orangensaft", "apple juice", "apfelsaft"] },
  { label: "coffee", icon: "☕", tags: ["kaffee"] },
  { label: "tea", icon: "🫖", tags: ["tee"] },
  { label: "beer", icon: "🍺", tags: ["bier"] },
  { label: "wine", icon: "🍷", tags: ["wein"] },
  { label: "soda", icon: "🥤", tags: ["cola", "soft drink", "softdrinks", "limonade"] },
  { label: "sparkling water", icon: "💧", tags: ["mineralwasser", "sprudel"] },
  { label: "cocoa", icon: "☕", tags: ["kakao", "hot chocolate", "heiße schokolade", "heisse schokolade"] },

  // Frozen
  { label: "ice cream", icon: "🍨", tags: ["eis", "gelato"] },
  { label: "frozen pizza", icon: "🍕", tags: ["tiefkühlpizza", "tiefkuehlpizza", "tk pizza"] },
  { label: "fries", icon: "🍟", tags: ["pommes", "pommes frites"] },
  { label: "frozen vegetables", icon: "🫛", tags: ["tiefkühlgemüse", "tiefkuehlgemuese", "tk gemüse", "tk gemuese"] },
  { label: "frozen berries", icon: "🫐", tags: ["tiefkühlbeeren", "tiefkuehlbeeren", "tk beeren"] },

  // Snacks
  { label: "chips", icon: "🍟", tags: ["kartoffelchips"] },
  { label: "chocolate", icon: "🍫", tags: ["schokolade"] },
  { label: "cookies", icon: "🍪", tags: ["kekse", "biscuit", "biscuits"] },
  { label: "popcorn", icon: "🍿", tags: ["popcorn"] },
  { label: "nuts", icon: "🥜", tags: ["nüsse", "nuesse", "mixed nuts"] },
  { label: "candy", icon: "🍬", tags: ["süßigkeiten", "suessigkeiten", "sweets"] },
  { label: "crackers", icon: "🥨", tags: ["cracker", "salzgebäck", "salzgebaeck"] },

  // Household
  { label: "toilet paper", icon: "🧻", tags: ["toilettenpapier"] },
  { label: "paper towels", icon: "🧻", tags: ["küchenrolle", "kuechenrolle"] },
  { label: "detergent", icon: "🧴", tags: ["waschmittel", "laundry detergent"] },
  { label: "dish soap", icon: "🧼", tags: ["spülmittel", "spuelmittel", "dishwashing liquid"] },
  { label: "soap", icon: "🧼", tags: ["seife", "hand soap", "handseife"] },
  { label: "sponge", icon: "🧽", tags: ["schwamm", "cleaning sponge"] },
  { label: "trash bags", icon: "🗑️", tags: ["müllbeutel", "muellbeutel", "garbage bags"] },
  { label: "batteries", icon: "🔋", tags: ["batterien"] },

  // Condiments
  { label: "salt", icon: "🧂", tags: ["salz"] },
  { label: "black pepper", icon: "🧂", tags: ["pfeffer", "peppercorn"] },
  { label: "olive oil", icon: "🫒", tags: ["olivenöl", "olivenoel", "öl", "oel", "oil"] },
  { label: "vinegar", icon: "🍶", tags: ["essig"] },
  { label: "ketchup", icon: "🍅", tags: ["ketchup"] },
  { label: "mustard", icon: "🌭", tags: ["senf"] },
  { label: "honey", icon: "🍯", tags: ["honig"] },
  { label: "jam", icon: "🍓", tags: ["marmelade", "konfitüre", "konfituere", "fruit spread"] }
];

export const EXACT_MATCH_MAP = createExactMatchMap(ICON_DB);
