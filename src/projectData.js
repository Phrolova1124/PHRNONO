export const projects = [
  {
    id: "foodStall",
    slug: "food-stall",
    title: "Food Stall",
    category: "3D",
    year: "2026",
    image: "/portfolio/food-stall.webp",
    artstationUrl: "https://www.artstation.com/artwork/lGgDXz",
    localUrl: "/work/food-stall",
  },
  {
    id: "coffeeGrinder",
    slug: "coffee-grinder",
    title: "Coffee Grinder",
    category: "3D",
    year: "2026",
    image: "/portfolio/coffee-grinder.webp",
    artstationUrl: "https://www.artstation.com/artwork/BaoYg4",
    localUrl: "/work/coffee-grinder",
  },
  {
    id: "pixelEnvironment",
    slug: "pixel-environment",
    title: "Pixel Environment",
    category: "PIXEL",
    year: "2026",
    image: "/portfolio/pixel-environment.webp",
    artstationUrl: "https://www.artstation.com/artwork/RqEV3W",
    localUrl: "/work/pixel-environment",
  },
  {
    id: "pixelAnimation",
    title: "Character Design",
    category: "PIXEL",
    year: "2026",
    image: "/portfolio/art-04-poster.webp",
    video: "/portfolio/art-04.webm",
    localUrl: "/character-design",
    artstationUrl: "https://www.artstation.com/artwork/x3lD0r",
  },
  {
    id: "artDesign",
    title: "Art Design",
    category: "GRAPHIC",
    year: "2026",
    image: "/portfolio/art-design.webp",
    artstationUrl: "https://www.artstation.com/artwork/rzE5EJ",
  },
  {
    id: "roomDesign",
    title: "Room Design",
    category: "3D",
    year: "2026",
    image: "/portfolio/room-design.webp",
    artstationUrl: "https://www.artstation.com/artwork/P4a5lL",
  },
];

export const caseStudies = projects.slice(0, 3).map((project, index) => ({
  ...project,
  code: ["3D / ENVIRONMENT", "3D / TEXTURING", "PIXEL / ENVIRONMENT"][index],
}));

export const detailProjects = {
  "food-stall": {
    id: "foodStall",
    slug: "food-stall",
    title: "Food Stall",
    code: "3D / ENVIRONMENT",
    year: "2026",
    software: ["3ds Max", "Substance 3D Painter"],
    artstationUrl: "https://www.artstation.com/artwork/lGgDXz",
    sketchfabUrl: "https://sketchfab.com/3d-models/food-still-fe9f44ce962a4049a5adb99c7b84234f",
    hero: {
      src: "/portfolio/detail/food-stall/final-01.webp",
      width: 772,
      height: 429,
    },
    images: [
      { src: "/portfolio/detail/food-stall/final-02.webp", width: 774, height: 432 },
      { src: "/portfolio/detail/food-stall/final-03.webp", width: 770, height: 444 },
    ],
    modelPreview: {
      src: "/portfolio/detail/food-stall/model-preview.jpg",
      width: 1920,
      height: 1080,
    },
  },
  "coffee-grinder": {
    id: "coffeeGrinder",
    slug: "coffee-grinder",
    title: "Coffee Grinder",
    code: "3D / MATERIAL STUDY",
    year: "2026",
    software: ["Substance 3D Painter"],
    artstationUrl: "https://www.artstation.com/artwork/BaoYg4",
    sketchfabUrl: "https://sketchfab.com/3d-models/coffee-grinder-649568b098dd48f799c0bfb4f6b6eadb",
    hero: {
      src: "/portfolio/detail/coffee-grinder/final-01.webp",
      width: 2161,
      height: 1274,
    },
    images: [
      { src: "/portfolio/detail/coffee-grinder/final-02.webp", width: 2161, height: 1274 },
      { src: "/portfolio/detail/coffee-grinder/final-03.webp", width: 2161, height: 1274 },
    ],
    modelPreview: {
      src: "/portfolio/detail/coffee-grinder/model-preview.jpg",
      width: 1920,
      height: 1080,
    },
  },
  "pixel-environment": {
    id: "pixelEnvironment",
    slug: "pixel-environment",
    title: "Pixel Environment",
    code: "PIXEL / ENVIRONMENT",
    year: "2026",
    software: [],
    artstationUrl: "https://www.artstation.com/artwork/RqEV3W",
    hero: {
      src: "/portfolio/detail/pixel-environment/final-01.webp",
      width: 1536,
      height: 1536,
    },
    images: [],
  },
};

export const detailProjectOrder = ["food-stall", "coffee-grinder", "pixel-environment"];
