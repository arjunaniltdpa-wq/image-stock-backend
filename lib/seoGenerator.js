import fs from "fs";
import path from "path";

const mapPath = path.join(process.cwd(), "lib", "categoryMap.json");
const categoryMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

export { categoryMap };


// Extra keywords per category for stronger SEO
const categoryExtraKeywords = {
  nature: [
    "landscape","forest","mountain","river","lake","sunset","sunrise","wildlife","hiking","trees",
    "waterfall","flowers","plants","meadow","snow","clouds","sky","greenery","nature trail","countryside",
    "grass","hill station","natural beauty","nature wallpaper","clean river","pond","flora","fauna",
    "jungle","spring","autumn","national park","rocky hills","mountain valley","quiet nature","pathway",
    "blue sky","forest path","woodland","nature birds","fresh air","nature lake","nature photography",
    "green forest","deep forest","peaceful nature","mountain snow","nature leaves","nature travel","scenic view"
  ],

  animals: [
    "pets","wildlife","birds","cats","dogs","lion","tiger","elephant","horse","cow",
    "goat","sheep","rabbit","bear","fox","wolf","zebra","giraffe","monkey","buffalo",
    "camel","squirrel","panda","kangaroo","dolphin","whale","shark","octopus","turtle","snake",
    "eagle","sparrow","owl","pigeon","peacock","duck","hen","parrot","penguin","butterfly",
    "fish","farm animals","zoo animals","baby animals","cute pets","animal portrait","wild cats","sea animals",
    "forest animals","underwater animals"
  ],

  vehicles: [
    "car","truck","bus","motorcycle","bicycle","train","airplane","boat","ship","van",
    "auto rickshaw","taxi","sports car","luxury car","electric car","EV","helicopter","jet","cruise","cargo truck",
    "pickup truck","SUV","sedan","bike race","road trip","highway","vintage car","tractor","cycle","ambulance",
    "fire truck","police car","mechanic","auto parts","engine","wheel","tire","car showroom","parking lot","traffic",
    "scooter","metro train","car wash","fuel station","delivery van","container truck","racing car","convertible","harley bike"
  ],

  travel: [
    "vacation","holiday","tourism","airport","passport","visa","hotel","resort","beach","mountains",
    "snow travel","camping","backpacking","world map","flight","cruise","luxury hotel","travel vlog","travel bag","tourist guide",
    "road trip","adventure","hiking","travel food","island","city travel","local culture","sunset travel","historic site","heritage",
    "museum","marketplace","shopping","night city","bus travel","train journey","desert safari","nature travel","resort pool","travel lifestyle",
    "tourist places","travel photography","temple","church","bridge","famous monuments","road journey","travel friends","travel couple","rafting"
  ],

  food: [
    "breakfast","lunch","dinner","pizza","burger","pasta","cake","dessert","cookies","ice cream",
    "fruits","vegetables","coffee","tea","smoothie","juice","cooking","chef","restaurant","street food",
    "seafood","chocolate","snacks","sandwich","biryani","fried chicken","noodles","salad","soup","grill",
    "buffet","steak","hotdog","indian food","chinese food","italian food","bakery","donut","cupcake","wrap",
    "pancakes","food plate","organic food","healthy food","gourmet","recipe","food truck","juice glass","sweet dish","beverage"
  ],

  technology: [
    "smartphone","laptop","computer","AI","robotics","software","coding","programming","hacker","cybersecurity",
    "server","data center","database","cloud computing","5G network","electronics","motherboard","processor","keyboard",
    "mouse","tablet","smartwatch","wearable tech","VR headset","AR technology","gaming pc","tech office","IT company","website design",
    "digital art","mobile apps","tech support","USB cable","battery","charger","camera","drone","earphones","tech background",
    "innovation","future technology","machine learning","virtual assistant","robot hand","digital world","internet","wifi router","data analytics","graphic card"
  ],

  city: [
    "urban","downtown","skyscraper","buildings","roads","traffic","bridge","street lights","cityscape","metro",
    "subway","city sunset","city night","rainy city","taxi","bus stop","shopping mall","street market","food stalls","crowd",
    "crosswalk","footpath","roundabout","modern city","old city","heritage buildings","apartments","office towers","city skyline",
    "monuments","metro station","underground train","fountain","city bridge","public park","city festival","music street","street art","graffiti",
    "bike lane","construction","railway station","local market","street performance","city bus","night traffic","city fog","city rain","busy street"
  ],

  business: [
    "office","meeting","teamwork","startup","corporate","CEO","employee","workspace","conference","presentation",
    "analytics","data chart","revenue","marketing","finance","business deal","handshake","boardroom","office desk","laptop work",
    "phone call","client meeting","company","professional","boss","strategy","growth","sales report","agreement","signing documents",
    "paperwork","digital marketing","team discussion","remote work","call center","business woman","business man","entrepreneur","investor",
    "business training","corporate office","brainstorming","project planning","office communication","hiring","interview","business success",
    "leadership","job meeting"
  ],

  people: [
    "portrait","smile","happy face","family","kids","children","friends","couple","selfie","tourist",
    "old man","old woman","mother and child","father and son","party","celebration","students","teacher","crowd","athlete",
    "runner","gym","fitness","artist","musician","singer","actor","model","chef","farmer",
    "doctor","nurse","police","soldier","worker","businessman","businesswoman","group photo","wedding couple","bride",
    "groom","dancer","swimmer","cyclist","driver","reader","writer","thinking person","team photo","street people"
  ],

  fashion: [
    "clothing","model","makeup","runway","designer","dress","t-shirt","hoodie","jacket","jeans",
    "saree","lehenga","kurti","heels","sneakers","sandals","hairstyle","jewelry","earrings","necklace",
    "fashion photo","beauty salon","lipstick","handbag","watch","sunglasses","street fashion","sportswear","formal wear","casual wear",
    "traditional wear","wedding dress","groom suit","kids fashion","women fashion","men fashion","fashion catalog","fashion studio","fashion shooting","perfume",
    "accessories","fashion influencer","boutique","makeover","nail art","bridal makeup","styling","designer wear","fashion pose","premium clothing"
  ],
 
  architecture: [
    "building","home design","modern house","interior design","exterior","villa","apartment","skyscraper","bridge","construction",
    "engineer","architecture plan","real estate","luxury house","penthouse","kitchen interior","living room","bedroom","hallway",
    "hotel building","office building","mall","heritage building","monument","palace","castle","church","temple","mosque",
    "wooden house","glass building","balcony","front elevation","garden house","interior decor","ceiling lights","furniture design","marble floor",
    "window design","door design","staircase","roof top","dining room","architecture photography","townhouse","minimal home","3D building","city architecture",
    "house painting","farmhouse","residential building"
  ],

  beach: [
    "ocean","sea","sand","waves","beach sunset","beach sunrise","coastline","tropical beach","island","summer vacation",
    "cruise","yacht","surfing","snorkeling","swimming","clear water","beach chair","sand castle","footprints on sand","beach umbrella",
    "resort","palm trees","cocktails","beach party","sunbathing","jet ski","lifeguard tower","deep ocean","blue water","calm waves",
    "beach walk","campfire on beach","shells","tropical island","holiday beach","travel beach","beach couple","romantic beach","beach photography",
    "fishing","boat on sea","sun rays","marine life","sea breeze","warm weather","white sand beach","rocky shore","sea horizon","tropical sunset"
  ],

  flowers: [
    "rose","sunflower","lily","lotus","tulip","marigold","orchid","garden flowers","flower bouquet","floral wallpaper",
    "flower field","pink flowers","yellow flowers","red roses","white flowers","flower pot","flower shop","blossom","spring flower","flower bed",
    "nature flower","wildflowers","flower petals","fresh flowers","flower festival","wedding flowers","romantic flowers","artificial flowers","flower garden",
    "beautiful flowers","tiny flowers","macro flower","flower closeup","flower background","morning flowers","dew on flowers","floral art","flower decoration",
    "flower bunch","hibiscus","daisy","jasmine","lavender","garden roses","flower texture","flower photography","blooming flower","floral pattern"
  ],

  sports: [
    "football","soccer","cricket","basketball","tennis","badminton","swimming","running","gym","workout",
    "boxing","karate","cycling","marathon","yoga","wrestling","stadium","sports shoes","tennis court","football field",
    "cricket bat","golf","skiing","surfing","skateboarding","hockey","volleyball","rugby","athlete","player",
    "sports trophy","championship","training","fitness coach","sports team","exercise","sports match","scoreboard","race track","sports fan",
    "gym equipment","bodybuilding","weights","fitness model","stretching","warm up","professional athlete","sports ground","tournament","team huddle"
  ],

  education: [
    "school","college","university","students","teacher","classroom","books","library","reading","studying",
    "exams","online classes","e-learning","laptop study","notebook","science lab","math class","chemistry","biology","computer class",
    "school kids","school bus","college campus","graduation","degree","chalkboard","whiteboard","class test","homework","study table",
    "pen","pencil","writing","group study","tuition","professor","school desk","education system","learning app","school uniform",
    "back to school","school play","kids reading","college group","open book","education success","knowledge","school competition","education concept","study materials"
  ],

  medical: [
    "hospital","doctor","nurse","medicine","pharmacy","surgery","stethoscope","healthcare","medical treatment","patient",
    "ambulance","operation theatre","hospital bed","medical report","x-ray","MRI","dentist","vaccine","covid","mask",
    "sanitizer","health checkup","blood test","thermometer","first aid","physiotherapy","pregnancy care","baby care","pediatric",
    "cardiology","neurology","orthopedic","eye check","hearing aid","medical equipment","doctors team","hospital ward","IV drip","blood pressure",
    "medical gloves","medical research","microscope","medicine bottle","hospital receptionist","emergency room","wheelchair","lab test","medical conference","health awareness"
  ],

  winter: [
    "snow","snowfall","snowman","skiing","mountain snow","cold weather","winter jacket","woolen clothes","ice","freezing",
    "gloves","scarf","winter night","hot coffee","fireplace","winter forest","winter landscape","icy road","snowstorm","winter travel",
    "winter boots","christmas","winter house","frozen lake","ice skating","snow mountains","sledge","winter holiday","snowy trees","icicles",
    "winter sunset","winter sunrise","snow covered cars","winter city","snow path","cold breath","winter fashion","kids in snow","winter village","white forest",
    "winter camping","winter festival","snow fight","winter gloves","winter fun","snow covered plants","winter photography","cold wind","winter vibes","winter adventure"
  ],

  summer: [
    "sunlight","hot weather","ice cream","cold drinks","swimming","beach vacation","summer holiday","shorts","sunglasses","sun hat",
    "lemon juice","mango","popsicle","clear sky","summer camp","summer dress","pool party","sun rays","watermelon","summer kids",
    "beach sports","tropical drinks","holiday tour","sunset beach","summer fruits","picnic","sunny day","air conditioner","cold water","beach walk",
    "surfing","sunscreen","summer road trip","flower garden","summer wind","hot air balloon","summer travel","summer activities","ice cubes","ocean view",
    "summer vibes","boat ride","summer food","beach umbrella","pool swim","sunny vacation","summer sale","heatwave","sunshine","tourist beach"
  ],

  wallpapers: [
    "HD wallpaper","4K wallpaper","mobile wallpaper","desktop wallpaper","nature wallpaper","dark wallpaper","minimal wallpaper","abstract wallpaper","colorful wallpaper","black wallpaper",
    "white wallpaper","gradient wallpaper","pattern wallpaper","texture wallpaper","bokeh wallpaper","galaxy wallpaper","space wallpaper","neon wallpaper","aesthetic wallpaper","mountain wallpaper",
    "flower wallpaper","city wallpaper","beach wallpaper","forest wallpaper","water wallpaper","sunset wallpaper","night wallpaper","art wallpaper","3D wallpaper","creative wallpaper",
    "animal wallpaper","car wallpaper","cute wallpaper","anime wallpaper","abstract art","geometric pattern","line art","blur background","wallpaper design","clean wallpaper",
    "pastel wallpaper","retro wallpaper","classic wallpaper","vintage wallpaper","neon lights","color splash","polygon design","color gradient","simple wallpaper","smooth texture"
  ],

  interior: [
    "living room","bedroom","kitchen","bathroom","sofa","furniture","chair","bed","dining table","wardrobe",
    "interior decor","lamps","chandelier","curtains","wall paint","floor design","home lighting","carpet","table decor","vase",
    "wall clock","interior plants","modern home","minimal interior","luxury interior","kids room","home office","mirror","cushions","cozy home",
    "bookshelf","art frame","TV unit","kitchen shelves","interior wallpaper","sofa set","stylish curtains","home renovation","tiles","wood flooring",
    "coffee table","interior architecture","false ceiling","ceiling lights","room divider","interior photography","window blinds","minimal living room","open kitchen","home interior design"
  ],

  festivals: [
    "diwali","christmas","eid","holi","new year","halloween","thanksgiving","pongal","ganesh chaturthi","durga puja",
    "ramadan","fireworks","festival lights","lantern","decoration","party","celebration","festive food","rangoli","gifts",
    "birthday","wedding celebration","cultural festival","festive crowd","stage show","concert","music festival","parade","traditional dance",
    "festival clothes","prayers","temple celebration","church ceremony","festival sweets","color festival","mehndi","festival night","festival shopping","flower decoration",
    "festival photoshoot","festival card","candles","christmas tree","santa claus","eid feast","new year countdown","party balloons","festival banner","festival background"
  ],

  kids: [
    "children","baby","toddler","kids playing","school kids","nursery","playground","toys","baby girl","baby boy",
    "kids fashion","kids drawing","kids study","cute kids","fun activities","baby sleeping","kids birthday","kids smile","siblings","kids learning",
    "infant","childhood memories","school bag","baby food","kindergarten","primary school","kids games","child artist","nursery class","kids craft",
    "babies laughing","kids running","jumping kids","kids reading","kids cartoon","small kids","kids posing","playing toys","kids sports","kids swimming",
    "baby crawling","funny babies","kids dress","play house","kids exercise","baby shower","kids walking","kids family","happy kids","baby photography"
  ],

  abstract: [
    "abstract art","abstract pattern","abstract background","geometric shapes","color splash","gradient","3D shapes","bokeh","liquid texture","smoke abstract",
    "neon abstract","lines pattern","color waves","minimal abstract","ink splash","paint splatter","color blocks","digital art","mixed colors","abstract wallpaper",
    "blur abstract","grunge texture","polygon pattern","modern abstract","art shapes","cubism","modern pattern","circle pattern","triangle pattern","color noise",
    "wave lines","liquid art","motion blur","watercolor abstract","dots pattern","halftone","colorful design","background texture","marble texture","abstract paint",
    "futuristic art","low poly","oil paint texture","neon waves","brush strokes","creative abstract","soft gradient","splatter paint","glass effect","abstract geometry"
  ],

  space: [
    "galaxy","stars","moon","planet","milky way","astronaut","space travel","rocket","nebula","space station",
    "satellite","solar system","meteor","comet","space wallpaper","night sky","black hole","space dust","star explosion","universe",
    "alien world","cosmic clouds","astronomy","moon surface","venus","mars","earth from space","sun","eclipse","shooting star",
    "space science","sky telescope","starry night","moon glow","space dark","cosmic lights","star cluster","space art","astronaut suit","spaceship",
    "science fiction","outer space","galaxy swirl","starfield","planet rings","cosmic nebula","space fantasy","moonlight","deep space","galactic core"
  ],

  drinks: [
    "juice","coffee","tea","cold drinks","soft drink","milkshake","smoothie","lemonade","cocktail","mocktail",
    "iced coffee","iced tea","mojito","soda","energy drink","fruit juice","mango shake","milk","chocolate shake","protein shake",
    "cold water","coconut water","orange juice","apple juice","grape juice","watermelon juice","cola","soda can","bar drinks","hot coffee",
    "green tea","black coffee","cappuccino","latte","espresso","coffee mug","tea cup","coffee beans","bartender","glass of juice",
    "drinking straw","refreshing drinks","summer drink","juice bottle","bar counter","tea pot","cafe","sparkling water","juicer","milk tea"
  ],

  business_office: [
    "office building","working desk","business meeting","teamwork","corporate people","startup office","conference room","presentation","boss","CEO",
    "team discussion","coffee meeting","office laptop","digital marketing","analytics","business success","growth chart","company staff","paperwork","deal signing",
    "employee training","business communication","customer support","call center","office cubicles","office chair","typing on laptop","office workspace","company team","professional dress",
    "businesswoman","businessman","office environment","office receptionist","client meeting","notebook writing","phone call","office handshake","remote work","coworking space",
    "office brainstorming","business interview","email work","business finance","office printer","sales meeting","tablet work","office schedule","business strategy","office planning"
  ],

  lifestyle: [
    "morning routine","coffee time","home lifestyle","healthy routine","food lifestyle","relaxing","fashion lifestyle","shopping","weekend", "travel lifestyle",
    "cooking at home","gym lifestyle","work from home","gardening","reading books","night routine","family lifestyle","party","picnic","music listening",
    "netflix","hobbies","drawing","pets lifestyle","home workout","yoga","meditation","gaming","road trip lifestyle","coffee shop lifestyle",
    "casual photography","nature walk","mobile browsing","working out","bike ride","evening walk","fun with friends","street lifestyle","urban lifestyle","country lifestyle",
    "summer lifestyle","winter lifestyle","sleeping","cleaning home","room decor","makeup routine","skincare routine","fashion shoot","phone addiction","daily routine"
  ],

  fitness: [
    "gym","workout","weights","treadmill","exercise","running","bodybuilding","pushups","dumbbells","fitness motivation",
    "yoga","meditation","cycling","swimming","sports fitness","athlete training","fitness instructor","protein shake","fitness clothing","fitness tracker",
    "jump rope","squats","weightlifting","cardio","fitness club","workout partner","abs workout","home workout","exercise mat","stretching",
    "boxing training","crossfit","gym equipment","pull ups","core training","gym selfie","fitness progress","personal trainer","fitness challenge","fitness routine",
    "morning workout","calorie burn","healthy lifestyle","running shoes","sports bra","outdoor workout","gym body","muscle training","flexibility training","fitness studio"
  ],

  pets: [
    "cute pets","dog","cat","parrot","hamster","rabbit","fish tank","pet food","pet shop","pet toys",
    "golden retriever","german shepherd","persian cat","kitten","puppy","bird cage","turtle","pet grooming","pet sleeping","pet owner",
    "pet playing","pet bed","pet bowl","dog walk","pet training","dog running","cat staring","pet love","pet bath","pet photoshoot",
    "pet smile","pet cuddle","funny pets","cute kittens","animal shelter","pet adoption","pet tongue out","pet friends","cat sleeping","dog jumping",
    "pet fashion","pet carrier","pet with kids","pet hug","dog park","pet collar","pet doctor","pet care","cute puppy","funny cat"
  ],

  weather: [
    "sunny day","rain","rainfall","storm","lightning","rainbow","cloudy sky","sunset sky","wind","fog",
    "snowfall","snowstorm","summer heat","sun rays","cold weather","monsoon","hurricane","raindrops","wet road","snow covered trees",
    "storm clouds","dark clouds","foggy morning","winter night","hot desert","rainy window","hailstorm","icy ground","sunrise sky","rainy umbrella",
    "winter morning","wind blowing","sandstorm","mist","rain water drops","summer sky","clear blue sky","weather changes","cloud patterns","rain clouds",
    "evening sky","cold breeze","heatwave","nature weather","humid weather","cloud storm","light rain","foggy road","light sunshine","snow mountain weather"
  ],

  cars_automobiles: [
    "sports car","luxury car","electric car","SUV","sedan","hatchback","vintage car","supercar","car interior","car exterior",
    "car headlights","car speed","racing car","convertible","pickup truck","truck transport","car wash","car detailing","car showroom","car engine",
    "mechanic shop","car wheels","tires","car dashboard","steering wheel","car seats","police car","ambulance","fire truck","taxi",
    "auto rickshaw","bus transport","metro bus","road trip car","car photography","car backlight","car parking","traffic cars","car service","tow truck",
    "diesel car","petrol car","hybrid car","brake system","car sound system","drifting car","highway driving","car repair","off-road car","car dealership"
  ],

  fruits_vegetables: [
    "apple","banana","orange","mango","grapes","watermelon","pineapple","papaya","lemon","pomegranate",
    "strawberry","blueberry","kiwi","avocado","pear","coconut","cherry","melon","guava","peach",
    "tomato","potato","onion","carrot","cucumber","cabbage","broccoli","capsicum","spinach","beetroot",
    "sweet corn","pumpkin","chili","radish","peas","cauliflower","lettuce","ginger","garlic","brinjal",
    "fruit salad","vegetable market","fresh fruits","fresh vegetables","fruit basket","vegetable chopping","healthy fruits","organic vegetables","fruit juice","fruit photography"
  ],

  gaming: [
    "video game","console gaming","pc gaming","gaming laptop","gaming mouse","gaming keyboard","esports","streaming","game controller","VR gaming",
    "arcade gaming","mobile gaming","gamer headset","gaming chair","FPS game","racing game","battle royale","multiplayer game","online gaming","game streaming",
    "gamer room","RGB lights","gaming setup","game live","gamer character","gaming avatar","gaming tournament","gaming event","strategy game","action game",
    "adventure game","RPG game","simulation game","sports game","gaming device","game scoreboard","gaming friends","gamer boy","gamer girl","game play",
    "video streaming","gaming studio","gaming desk","gaming PC build","gaming posters","stream highlights","game victory","gaming competition","leaderboard","gaming community"
  ],

  water_nature: [
    "river","stream","lake","pond","waterfall","ocean waves","blue water","boat on water","bridge over water","reflection in water",
    "clean river","fountain","water splash","underwater view","beach water","water droplets","rain water","canal","water flow","dam",
    "waterfall rocks","swimming pool","ocean surface","water texture","ripples","sea foam","deep water","fish underwater","coral underwater","sea diving",
    "water landscape","water clouds reflection","drinking water","fresh water","water purity","natural water","spring water","flowing river","water depth","calm lake",
    "nature dam","green lake","river stones","river sunset","river sunrise","mountain river","ocean tide","river bridge","water cave","water photography"
  ],

  mountains_hiking: [
    "mountain range","snow mountains","hill station","mountain valley","trekking","hiking trail","mountain camp","sunrise mountains","mountain lake","green mountains",
    "mountain peak","rock climbing","mountain cave","mountain snowfall","mountain sunset","mountain clouds","mountain forest","adventure hiking","glacier","mountain river",
    "mountain path","camping tent","mountain trees","mountain wildlife","mountain rocks","cliff edge","mountain summit","hiking backpack","mountain travel","hiking friends",
    "mountain waterfall","mountain road","mountain photography","mountain aerial","snow trekking","high altitude","mountain air","mountain peace","adventure travel","mountain cabin",
    "hiker posing","mountain storm","steep path","mountain grass","mountain wind","campfire","mountain bike","hiking boots","camp spot","mountain view"
  ],

  food_cooking: [
    "home cooking","chef cooking","kitchen food","recipe making","cutting vegetables","frying pan","grill","barbecue","tandoor","curry",
    "baking cake","roti making","tawa cooking","cooking spices","street chef","restaurant kitchen","food ingredients","cooking oil","frying food","boiling",
    "pressure cooker","mixer grinder","chopping board","knife cutting","cooking gas","cooking stove","baking cookies","stir fry","food preparation","cooking class",
    "baking bread","breakfast cooking","lunch preparation","dinner plate","kitchen counter","food seasoning","salt and pepper","chef uniform","cooking apron","plating food",
    "salad preparation","kitchen tools","cooking tutorial","slicing fruits","hot pot","deep frying","kitchen chef","cooking spices mix","hand cooking","food garnishing"
  ],

  tools_hardware: [
    "hammer","screwdriver","wrench","pliers","saw","drill machine","toolbox","nails","screws","spanner",
    "tape measure","sandpaper","cutter blade","pliers set","axe","chainsaw","bolts","nuts","tool set","workshop tools",
    "mechanical tools","electric drill","tool shelf","wood cutter","metal tools","construction tools","tool belt","tool kit","hardware store","file tool",
    "grinder","measuring tools","paint brush","woodworking tools","cutting pliers","tool organization","safety gloves","safety helmet","welding tools","bolting machine",
    "tool mechanic","rust remover","tool cabinet","hardware nuts","tool repair","tool equipment","heavy tools","garage tools","power tools","workbench"
  ],

  furniture_home: [
    "sofa","chair","dining table","bed","wardrobe","coffee table","TV stand","bookshelf","drawer","desk",
    "office chair","bean bag","armchair","rocking chair","bedside lamp","floor lamp","cushions","curtains","carpet","rug",
    "mirror","wall art","pillow","home decor","plant pot","vase","shoe rack","side table","kitchen chairs","wooden furniture",
    "glass table","modern furniture","rustic furniture","interior furniture","living room sofa","bedroom decor","furniture shop","home showroom","interior design furniture","sofa set",
    "wooden wardrobe","kids study table","study chair","kitchen cabinet","bed sheets","recliner sofa","couch","table lamp","furniture design","interior styling"
  ],

  school_supplies: [
    "books","notebooks","pen","pencil","eraser","sharpener","color pencils","tablet in school","laptop study","school bag",
    "chalkboard","whiteboard","chalk","geometry box","pencil case","scale","compass","science kit","school uniform","school lunch",
    "water bottle","homework","study table","classroom board","stickers","crayons","sketchbook","project paper","art supplies","poster colors",
    "black pen","blue pen","school bus","textbook","online class","school ID card","dictionary","calculator","school files","document folder",
    "glue stick","highlighter","library books","class timetable","school notebook","student assignment","school stationery","clipboard","binder","pen holder"
  ],

  office_supplies: [
    "laptop","mouse","keyboard","office notebook","sticky notes","pen stand","files","paper sheets","office printer","calculator",
    "whiteboard","marker","paper clips","stapler","staple pins","tape","glue","stamp pad","ID card","desk organizer",
    "clipboard","envelope","business cards","letterhead","punch machine","paper shredder","USB drive","office drawer","business stamp","calendar",
    "desk phone","telephone","diary","notepad","office planner","transparent folder","binder clips","scissors","desk lamp","office tray",
    "sticky labels","ink cartridge","photocopy paper","plastic folder","memo pad","pen refill","magnetic board","notice board","projector","card holder"
  ],

  construction_industry: [
    "construction site","cement bags","bricks","sand","steel rods","construction workers","engineer","architect","building crane","bulldozer",
    "excavator","road rollers","cement mixer","safety helmet","construction gloves","blueprint","surveying","site measurement","cement blocks","construction truck",
    "concrete machine","bridge construction","road construction","building foundation","tower construction","pipe fitting","plumbing work","electrical wiring","wood cutting","brick mason",
    "scaffolding","building pillars","welding machine","industrial crane","cement pouring","construction tools","site supervisor","construction safety","high rise building","work in progress",
    "industrial area","factory building","warehouse","heavy machinery","labour team","safety jacket","steel structure","floor tiling","site materials","industrial development"
  ],

  beauty_makeup: [
    "makeup kit","lipstick","eyeliner","foundation","compact powder","blush","makeup brush","hair dryer","nail polish","manicure",
    "pedicure","eyeshadow","salon makeup","bridal makeup","beauty parlor","spa treatment","skincare","face cream","hair treatment","beauty influencer",
    "beauty salon","facial massage","hair straightening","hair curling","hairstyle","beauty products","cosmetics shop","perfume bottle","body lotion","face mask",
    "beauty mirror","makeup palette","lip gloss","mascara","hair coloring","haircut","eyebrow shaping","eyelash extension","nose contour","face contour",
    "foundation blending","beauty model","beauty photography","beauty vlogger","makeup tutorial","makeup sponge","cosmetic bag","skincare products","beautiful hair","lip liner"
  ],

  real_estate: [
    "house for sale","property sale","residential area","modern house","apartment building","flat interior","villa exterior","real estate agent","property deal","luxury apartment",
    "commercial building","shop for sale","villa swimming pool","house interior","kitchen cabinets","real estate business","new house keys","property documents","construction site","real estate office",
    "real estate investment","villa garden","residential tower","balcony view","open house","land for sale","house loan","house rent","apartment balcony","home purchase",
    "property handover","house exterior","modern architecture","gated community","villa area","real estate marketing","home renovation","interior staging","property photography","property listing",
    "real estate signboard","townhouse","property consultant","city housing","luxury real estate","villa bedroom","real estate contract","real estate keys","house inspection","property buyers"
  ],

  religion_worship: [
    "temple","church","mosque","prayer","worship","holy book","religious festival","lighting lamps","holy cross","holy water",
    "bible","quran","bhagavad gita","bells","devotional songs","god idol","holy incense","prayer mat","rosary","monk",
    "priest","holy ceremony","religious gathering","holy statue","festival rituals","holy offering","pilgrimage","holy light","meditation","spiritual man",
    "holy flowers","prayer candle","religious symbol","peace meditation","devotional worship","temple bells","church choir","holy place","christian prayer","islamic prayer",
    "buddhist temple","sikh gurudwara","religious architecture","holy cross symbol","diya lighting","prayer hands","religious event","spiritual art","church building","mosque dome"
  ],

  transport_logistics: [
    "cargo","container ship","cargo truck","delivery van","air cargo","freight train","warehouse","container yard","logistics company","delivery service",
    "shipping port","cargo loading","cargo lift","cargo packaging","import export","delivery boxes","postal delivery","express courier","truck loading","goods transport",
    "airport cargo","container crane","distribution center","forklift","logistics staff","packing warehouse","goods shipment","supply chain","shipping label","delivery bike",
    "cargo airplane","ship unloading","truck parking","transport industry","logistics route","parcel box","shipping container","warehouse storage","cargo handling","logistics teamwork",
    "cargo monitoring","truck driver","delivery partners","industrial transport","international shipping","road cargo","ship crew","truck trailer","freight forwarding","warehouse management"
  ],
  
  music: [
    "guitar","piano","drums","violin","music band","singer","microphone","concert","music studio","DJ",
    "headphones","earphones","music notes","music festival","live performance","recording mic","music mixing","audio equalizer","mp3 player","sound waves",
    "music speaker","karaoke","concert crowd","music event","classical music","rock band","jazz music","rap singer","music production","voice recording",
    "sound engineer","electric guitar","bass guitar","music album","vinyl record","music headphones","sound box","harmonica","flute","tabla",
    "singer stage","music video","recording laptop","sound system","music cables","drum sticks","keyboard piano","guitar strings","headphone jack","music playlist"
  ],

  art_drawing: [
    "sketching","pencil drawing","painting","watercolors","oil painting","canvas art","art brushes","color palette","crayons","acrylic paint",
    "ink drawing","marker art","charcoal drawing","digital art","art gallery","paper drawing","art tools","drawing book","art tutorial","paint mixing",
    "paint splatter","art board","easel","artist hand","portrait drawing","cartoon drawing","animal sketch","face sketch","landscape drawing","art class",
    "school drawing","children painting","color mixing","brush strokes","art creativity","handmade art","spray paint","wall painting","murals","graffiti art",
    "art competition","drawing pen","paint brush holder","color pencils","poster colors","art exhibition","creative art","fine arts","art students","art design"
  ],

  agriculture_farming: [
    "farmer","tractor","ploughing","rice field","wheat farming","sugarcane field","cotton farm","farm animals","cattle","buffalo",
    "goats","cow shed","hens","green farm","irrigation","sprinkler farming","farmer tools","crop harvesting","tractor plough","farm soil",
    "barn","village", "farmers market","agriculture land","fertilizer","seeds","crop field","agriculture tractor","organic farming","farmer family",
    "milk farm","dairy farm","farm vegetables","paddy fields","haystack","farm sunrise","farm sunset","green crops","planting seeds","watering plants",
    "farm workers","farm house","agriculture machinery","harvesting machine","farm products","farming business","cattle feed","grain bags","farm storage","farmer labor"
  ],

  hotels_hospitality: [
    "hotel room","luxury hotel","reception desk","hotel lobby","hotel building","hotel staff","room service","hotel keycard","hotel bed","hotel bathroom",
    "hotel restaurant","hotel breakfast","swimming pool","spa center","hotel lift","hotel hallway","hotel corridor","hotel balcony","hotel laundry","hotel bellboy",
    "hotel booking","hotel front desk","hotel food","buffet restaurant","hotel chef","mini bar","hotel interior","resort stay","holiday hotel","beach resort",
    "mountain resort","5 star hotel","hotel window view","hotel luggage","hotel guests","hotel service","resort garden","hotel lighting","honeymoon suite","hotel pillows",
    "hotel card","hotel signboard","hotel checkout","hotel stay","luxury resort","hotel coffee","hotel room decor","hotel dining","hotel spa","room cleaning"
  ],

  work_from_home: [
    "laptop work","desk setup","home office","coffee mug","typing","online meeting","video call","freelancer","remote work","work desk",
    "headphones","notepad","mobile work","work chair","home table","tablet work","coding from home","designer work","freelance job","online teaching",
    "graphic designing","home comfort","productivity","deadline work","time management","online chat","webcam meeting","client communication","email work","creative work",
    "business call","typing keyboard","wifi router","digital nomad","work break","home study","task planning","office files","team meeting online","project work",
    "work reports","blog writing","content writer","digital marketing work","laptop charging","calendar planner","home workstation","office at home","working mother","remote teamwork"
  ]
};




// -----------------------------
// Tokenize filename
// -----------------------------
function tokenizeFilename(filename) {
  let name = filename.replace(/\.[^/.]+$/, "").toLowerCase();

  // Remove trailing numbers (001, 002, etc.) for SEO
  name = name.replace(/[- ]?\(?\d+\)?$/, "");

  return name
    .replace(/[_\s]+/g, "-")
    .split("-")
    .map(w => w.trim())
    .filter(Boolean);
}

// -----------------------------
// Detect category from words
// -----------------------------
function detectCategory(words) {
  for (const w of words) {
    if (categoryMap[w]) return categoryMap[w];
  }
  for (const w of words) {
    const singular = w.replace(/s$/, "");
    if (categoryMap[singular]) return categoryMap[singular];
  }
  return "photo";
}

// -----------------------------
// Capitalize first letter
// -----------------------------
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -----------------------------
// Generate SEO from filename
// -----------------------------
export function generateSEOFromFilename(filename) {
  const words = tokenizeFilename(filename);
  const mainCategory = detectCategory(words);

  // Keywords for SEO
  const extras = categoryExtraKeywords[mainCategory] || [];
  const genericExtras = [
    "HD wallpaper",
    "4K wallpaper",
    "free stock photo",
    "background image",
    "desktop wallpaper",
    "photography",
    "free download",
    "high resolution",
    "beautiful",
    "creative"
  ];

  const tags = Array.from(new Set([...words, ...extras, ...genericExtras])).slice(0, 30);

  // Title
  const title = `${capitalize(words.join(" ")) || "HD Wallpaper"} | Free ${capitalize(mainCategory)} Background Images Download`;

  // SEO-friendly Description
  const description = `Download free high-quality ${words.join(" ") || "HD"} ${mainCategory} wallpapers and background images. Perfect for desktops, laptops, mobile devices, and creative projects. Explore stunning ${mainCategory} images with vibrant colors, professional photography, and high resolution. Free to download and use for personal and commercial projects. Enhance your device with beautiful ${mainCategory} photos online.`;

  // Alt Text
  const alt = `Free ${words.join(" ") || "HD"} ${mainCategory} wallpaper and background photo in high resolution.`;

  return {
    title,
    description,
    alt,
    tags,
    category: mainCategory
  };
}
