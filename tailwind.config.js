/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  // Obsidian ships its own reset/base styles; a colliding Tailwind preflight
  // fights the host app's CSS (buttons, inputs, headings all get reset twice).
  // Scoping everything under .akc-dashboard and disabling preflight keeps
  // this plugin's styles self-contained.
  corePlugins: {
    preflight: false,
  },
  important: ".akc-dashboard",
  theme: {
    extend: {
      colors: {
        emerald: require("tailwindcss/colors").emerald,
        purple: require("tailwindcss/colors").purple,
        slate: require("tailwindcss/colors").slate,
      },
    },
  },
  plugins: [],
};
