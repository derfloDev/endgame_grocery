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
  { label: "milk", icon: "IconMilk", tags: ["milch", "whole milk", "vollmilch", "oat milk", "hafermilch"] },
  { label: "cheese", icon: "IconCheese", tags: ["käse", "kaese", "gouda", "cheddar", "mozzarella"] },
  { label: "butter", icon: "IconBottle", tags: ["butter"] },
  { label: "yogurt", icon: "IconMilkshake", tags: ["yoghurt", "joghurt"] },
  { label: "egg", icon: "IconEgg", tags: ["eggs", "ei", "eier"] },
  { label: "omelette", icon: "IconEggFried", tags: ["fried egg", "spiegelei", "omelett"] },
  { label: "cream", icon: "IconBottle", tags: ["sahne", "whipping cream", "schlagsahne"] },
  { label: "quark", icon: "IconCheese", tags: ["curd cheese", "speisequark"] },
  { label: "cottage cheese", icon: "IconCheese", tags: ["hüttenkäse", "huettenkaese", "körniger frischkäse"] },
  { label: "milkshake", icon: "IconMilkshake", tags: ["shake", "milchshake"] },

  // Produce
  { label: "apple", icon: "IconApple", tags: ["apfel", "apples", "äpfel", "aepfel"] },
  { label: "banana", icon: "IconCherry", tags: ["banane", "bananas", "bananen"] },
  { label: "tomato", icon: "IconSalad", tags: ["tomate", "tomatoes", "tomaten"] },
  { label: "carrot", icon: "IconCarrot", tags: ["karotte", "karotten", "möhre", "moehre", "möhren", "moehren"] },
  { label: "cucumber", icon: "IconSalad", tags: ["gurke", "gurken"] },
  { label: "lettuce", icon: "IconSalad", tags: ["salat", "kopfsalat", "romaine"] },
  { label: "bell pepper", icon: "IconPepper", tags: ["paprika", "paprikaschote"] },
  { label: "potato", icon: "IconCarrot", tags: ["kartoffel", "kartoffeln", "potatoes"] },
  { label: "onion", icon: "IconLeaf2", tags: ["zwiebel", "zwiebeln"] },
  { label: "garlic", icon: "IconPepper", tags: ["knoblauch"] },
  { label: "lemon", icon: "IconLemon", tags: ["zitrone", "zitronen"] },
  { label: "lime", icon: "IconLemon2", tags: ["limette", "limetten"] },
  { label: "grapes", icon: "IconCherry", tags: ["trauben", "weintrauben"] },
  { label: "strawberry", icon: "IconCherry", tags: ["erdbeere", "erdbeeren", "strawberries"] },
  { label: "mushroom", icon: "IconMushroom", tags: ["pilz", "pilze", "champignon", "champignons"] },
  { label: "avocado", icon: "IconAvocado", tags: ["avocados"] },
  { label: "broccoli", icon: "IconLeaf", tags: ["brokkoli"] },
  { label: "corn", icon: "IconLeaf2", tags: ["mais"] },
  { label: "spinach", icon: "IconLeaf", tags: ["spinat"] },
  { label: "pumpkin", icon: "IconSalad", tags: ["kürbis", "kuerbis"] },

  // Bakery
  { label: "bread", icon: "IconBread", tags: ["brot", "toast"] },
  { label: "bread roll", icon: "IconBread", tags: ["bread rolls", "brötchen", "broetchen", "roll"] },
  { label: "baguette", icon: "IconBread", tags: ["baguette"] },
  { label: "croissant", icon: "IconCakeRoll", tags: ["croissants"] },
  { label: "pretzel", icon: "IconBread", tags: ["brezel", "pretzels"] },
  { label: "cake", icon: "IconCake", tags: ["kuchen"] },
  { label: "cake roll", icon: "IconCakeRoll", tags: ["biskuitrolle"] },
  { label: "flour", icon: "IconCup", tags: ["mehl"] },

  // Meat and fish
  { label: "chicken", icon: "IconMeat", tags: ["hähnchen", "haehnchen", "huhn"] },
  { label: "beef", icon: "IconMeat", tags: ["rind", "rindfleisch"] },
  { label: "bacon", icon: "IconSausage", tags: ["speck"] },
  { label: "sausage", icon: "IconSausage", tags: ["wurst", "würstchen", "wuerstchen"] },
  { label: "ham", icon: "IconSausage", tags: ["schinken"] },
  { label: "fish", icon: "IconFish", tags: ["fisch", "lachs", "salmon"] },
  { label: "shrimp", icon: "IconFishBone", tags: ["garnele", "garnelen", "prawn", "prawns"] },
  { label: "turkey", icon: "IconMeat", tags: ["pute", "putenfleisch", "truthahn"] },

  // Beverages
  { label: "water", icon: "IconDroplet", tags: ["wasser", "still water", "stilles wasser"] },
  { label: "juice", icon: "IconGlassFull", tags: ["saft", "orange juice", "orangensaft", "apple juice", "apfelsaft"] },
  { label: "coffee", icon: "IconCoffee", tags: ["kaffee"] },
  { label: "tea", icon: "IconCup", tags: ["tee"] },
  { label: "beer", icon: "IconBeer", tags: ["bier"] },
  { label: "wine", icon: "IconGlassChampagne", tags: ["wein", "sparkling wine", "sekt"] },
  { label: "soda", icon: "IconGlass", tags: ["cola", "soft drink", "softdrinks", "limonade"] },
  { label: "sparkling water", icon: "IconDroplets", tags: ["mineralwasser", "sprudel"] },
  { label: "cocoa", icon: "IconMug", tags: ["kakao", "hot chocolate", "heiße schokolade", "heisse schokolade"] },
  { label: "bottle water", icon: "IconBottle", tags: ["water bottle", "wasserflasche"] },

  // Frozen
  { label: "ice cream", icon: "IconIceCream2", tags: ["eis", "gelato"] },
  { label: "ice cream cone", icon: "IconIceCream", tags: ["soft serve", "softeis"] },
  { label: "frozen pizza", icon: "IconPizza", tags: ["tiefkühlpizza", "tiefkuehlpizza", "tk pizza"] },
  { label: "fries", icon: "IconBurger", tags: ["pommes", "pommes frites"] },
  { label: "frozen vegetables", icon: "IconSnowflake", tags: ["tiefkühlgemüse", "tiefkuehlgemuese", "tk gemüse", "tk gemuese"] },
  { label: "frozen berries", icon: "IconSnowflake", tags: ["tiefkühlbeeren", "tiefkuehlbeeren", "tk beeren"] },

  // Snacks
  { label: "chips", icon: "IconBurger", tags: ["kartoffelchips"] },
  { label: "chocolate", icon: "IconCandy", tags: ["schokolade"] },
  { label: "cookies", icon: "IconCookie", tags: ["kekse", "biscuit", "biscuits"] },
  { label: "gingerbread", icon: "IconCookieMan", tags: ["lebkuchen"] },
  { label: "popcorn", icon: "IconCandy", tags: ["movie snack"] },
  { label: "nuts", icon: "IconLeaf2", tags: ["nüsse", "nuesse", "mixed nuts"] },
  { label: "candy", icon: "IconCandy", tags: ["süßigkeiten", "suessigkeiten", "sweets"] },
  { label: "crackers", icon: "IconBread", tags: ["cracker", "salzgebäck", "salzgebaeck"] },
  { label: "cookies dough", icon: "IconCookie", tags: ["cookie dough", "keksteig"] },
  { label: "cake snack", icon: "IconCakeRoll", tags: ["snack cake", "minikuchen"] },

  // Household
  { label: "toilet paper", icon: "IconToiletPaper", tags: ["toilettenpapier"] },
  { label: "paper towels", icon: "IconToiletPaper", tags: ["küchenrolle", "kuechenrolle"] },
  { label: "detergent", icon: "IconWashMachine", tags: ["waschmittel", "laundry detergent"] },
  { label: "fabric softener", icon: "IconWash", tags: ["weichspüler", "weichspueler", "softener"] },
  { label: "dish soap", icon: "IconWash", tags: ["spülmittel", "spuelmittel", "dishwashing liquid"] },
  { label: "soap", icon: "IconWash", tags: ["seife"] },
  { label: "hand soap", icon: "IconWash", tags: ["handseife"] },
  { label: "sponge", icon: "IconSparkles", tags: ["schwamm", "cleaning sponge"] },
  { label: "trash bags", icon: "IconTrash", tags: ["müllbeutel", "muellbeutel", "garbage bags"] },
  { label: "batteries", icon: "IconBattery", tags: ["batterien"] },
  { label: "light bulbs", icon: "IconBulb", tags: ["glühbirnen", "gluehbirnen", "lampen"] },
  { label: "cleaner", icon: "IconSpray", tags: ["reiniger", "all-purpose cleaner", "allzweckreiniger"] },
  { label: "glass cleaner", icon: "IconSpray", tags: ["fensterreiniger"] },
  { label: "bucket", icon: "IconBucket", tags: ["putzeimer"] },
  { label: "mop", icon: "IconBucketDroplet", tags: ["wischmopp", "mopp"] },
  { label: "broom", icon: "IconBrush", tags: ["besen"] },
  { label: "laundry basket", icon: "IconBasket", tags: ["wäschekorb", "waeschekorb"] },
  { label: "hangers", icon: "IconHanger", tags: ["kleiderbügel", "kleiderbuegel"] },
  { label: "iron", icon: "IconIroning", tags: ["bügeleisen", "buegeleisen"] },
  { label: "foil", icon: "IconToolsKitchen", tags: ["alufolie", "aluminium foil"] },
  { label: "baking paper", icon: "IconToolsKitchen2", tags: ["backpapier"] },
  { label: "storage bags", icon: "IconToolsKitchen3", tags: ["frischhaltebeutel", "zip bags"] },
  { label: "dish brush", icon: "IconBrush", tags: ["spülbürste", "spuelbuerste"] },
  { label: "cleaning cloth", icon: "IconShirt", tags: ["putztuch", "microfiber cloth"] },

  // Condiments
  { label: "salt", icon: "IconSalt", tags: ["salz"] },
  { label: "black pepper", icon: "IconPepper", tags: ["pfeffer", "peppercorn"] },
  { label: "olive oil", icon: "IconBottle", tags: ["olivenöl", "olivenoel", "öl", "oel", "oil"] },
  { label: "vinegar", icon: "IconBottle", tags: ["essig"] },
  { label: "ketchup", icon: "IconBottle", tags: ["ketchup"] },
  { label: "mustard", icon: "IconBottle", tags: ["senf"] },
  { label: "honey", icon: "IconBottle", tags: ["honig"] },
  { label: "jam", icon: "IconCherry", tags: ["marmelade", "konfitüre", "konfituere", "fruit spread"] },
  { label: "mayonnaise", icon: "IconBottle", tags: ["mayo"] },
  { label: "pasta sauce", icon: "IconBottle", tags: ["pastasauce"] },

  // Pantry
  { label: "pasta", icon: "IconToolsKitchen2", tags: ["nudeln"] },
  { label: "rice", icon: "IconCup", tags: ["reis"] },
  { label: "soup", icon: "IconSoup", tags: ["suppe"] },
  { label: "pizza", icon: "IconPizza", tags: ["pizza"] },
  { label: "sausage snack", icon: "IconSausage", tags: ["snack wurst"] },

  // Drugstore
  { label: "shampoo", icon: "IconFlask", tags: ["haarshampoo"] },
  { label: "conditioner", icon: "IconFlask2", tags: ["spülung", "spuelung"] },
  { label: "body wash", icon: "IconDroplet", tags: ["duschgel"] },
  { label: "toothpaste", icon: "IconDental", tags: ["zahnpasta"] },
  { label: "toothbrush", icon: "IconDental", tags: ["zahnbürste", "zahnbuerste"] },
  { label: "mouthwash", icon: "IconDental", tags: ["mundspülung", "mundspuelung"] },
  { label: "razor", icon: "IconRazor", tags: ["rasierer"] },
  { label: "shaving cream", icon: "IconRazor", tags: ["rasiercreme"] },
  { label: "deodorant", icon: "IconPerfume", tags: ["deo"] },
  { label: "perfume", icon: "IconPerfume", tags: ["parfüm", "parfuem"] },
  { label: "sunscreen", icon: "IconSun", tags: ["sonnencreme"] },
  { label: "after sun", icon: "IconSunHigh", tags: ["aftersun"] },
  { label: "medicine", icon: "IconPill", tags: ["medikamente", "tabletten"] },
  { label: "vitamins", icon: "IconPills", tags: ["vitamine"] },
  { label: "first aid kit", icon: "IconFirstAidKit", tags: ["erste hilfe", "verbandkasten"] },
  { label: "bandages", icon: "IconBandage", tags: ["pflaster", "verbände", "verbaende"] },
  { label: "thermometer", icon: "IconThermometer", tags: ["fieberthermometer"] },
  { label: "baby care", icon: "IconBabyBottle", tags: ["babypflege"] },
  { label: "diapers", icon: "IconBabyCarriage", tags: ["windeln"] },
  { label: "contact lenses", icon: "IconEye", tags: ["kontaktlinsen"] },
  { label: "glasses cleaner", icon: "IconEyeglass", tags: ["brillenreiniger"] },
  { label: "cough syrup", icon: "IconMedicineSyrup", tags: ["hustensaft"] },
  { label: "vaccine", icon: "IconVaccineBottle", tags: ["impfung"] },
  { label: "medical supplies", icon: "IconMedicalCross", tags: ["medizinbedarf"] },
  { label: "stethoscope", icon: "IconStethoscope", tags: ["arztbedarf"] }
];

export const EXACT_MATCH_MAP = createExactMatchMap(ICON_DB);
