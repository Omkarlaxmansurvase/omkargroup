// Run once: node seed.js
// Puts National Mount View into the database using the images already in frontend/images.
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const project = {
  slug: "national-mount-view",
  name: "National Mount View",
  builder: "National Builders",
  location: "Akurli, New Panvel",
  rera_number: "", // TODO: project RERA number
  tagline: "Three 20-storey towers above the Akurli tree line, with a landscaped podium, pool and clubhouse.",
  description:
    "National Mount View by National Builders offers 2 and 3 BHK flats in three 20-storey towers at Akurli, New Panvel. The podium has a swimming pool, play court, lawn, walking track, banquet hall and community hall. RERA registered.",
  hero_image: "/images/aerial.jpg",
  gallery: ["/images/facade.jpg", "/images/aerial.jpg", "/images/podium-plan.jpg"],
  configurations: [
    { type: "2 BHK", size: "1350 sq.ft", price: "", plans: ["/images/plan-2bhk-a.jpg", "/images/plan-2bhk-b.jpg"] },
    { type: "3 BHK", size: "1830 sq.ft", price: "", plans: ["/images/plan-3bhk-a.jpg", "/images/plan-3bhk-b.jpg"] },
  ],
  amenities: [
    "Swimming pool", "Club house", "Gymnasium", "Sports and play court", "Kids play area", "Landscaped lawn",
    "Walking track", "Banquet hall", "Community hall", "Library", "Guest rooms", "Gazebo and seating",
    "24x7 security", "Power backup", "Luxury lifts", "Parking and water supply",
  ],
  nearby: [
    { category: "Schools", items: ["DPS", "DAV"] },
    { category: "Transport", items: ["Panvel Railway Station", "Metro"] },
    { category: "Shopping", items: ["DMart", "Local market"] },
  ],
  map_link: "https://www.google.com/maps/search/National+Mount+View+Akurli+New+Panvel",
  status: "active",
};

(async () => {
  const { error } = await db.from("projects").upsert(project, { onConflict: "slug" });
  console.log(error ? error.message : "Seeded: /national-mount-view");
})();